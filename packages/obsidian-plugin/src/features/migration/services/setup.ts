import { Notice, Platform } from "obsidian";
import type McpToolsPlugin from "$/main";
import { globalSettingsMutex } from "$/features/command-permissions";
import { logger } from "$/shared/logger";
import {
  detectLegacyInstall,
  hasAnyLegacySignal,
  type LegacyInstallState,
} from "./detect";
import { executeSteps, planMigration, type MigrationContext } from "./plan";
import { MigrationModalHost } from "./migrationModalHost";

/**
 * First-load wiring for the migration modal.
 *
 * Called from `main.ts:onload` after the HTTP transport has been set
 * up so the live `port` + `bearerToken` are available. Does the
 * minimum work synchronously (read `data.json`, run the detector) and
 * defers the modal itself to `app.workspace.onLayoutReady` so the
 * Obsidian UI is fully drawn first.
 *
 * Safe to call regardless of whether legacy state is present — it
 * is a no-op for fresh installs.
 *
 * Single-shot per plugin load: if the user dismisses the modal (Esc /
 * X / Skip), a `skippedAt` ISO timestamp is written under
 * `migration.skippedAt` in `data.json`. Subsequent loads see the
 * timestamp and bypass the modal entirely. Re-running the migration
 * later is reachable from the Settings UI (planned T8.b — a small
 * "Run migration check…" button).
 */

const SKIPPED_KEY = "migration";
const LEARN_MORE_URL =
  "https://github.com/istefox/obsidian-mcp-connector#upgrading-from-03x";

export async function setupMigration(
  plugin: McpToolsPlugin,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const pluginData = ((await plugin.loadData()) ?? {}) as Record<
      string,
      unknown
    >;

    // Run the detector first regardless of `skippedAt`. The dismissal
    // suppresses the modal (intentional — modal nag is bad UX), but
    // not the recurring soft signal: if the user dismissed the modal
    // and the legacy state is *still* there on a later load, surface
    // a non-blocking Notice so the disconnect doesn't stay silent
    // forever. Fork issue #78.
    const state = await detectLegacyInstall({ pluginData });
    const skippedSlice =
      (pluginData[SKIPPED_KEY] as Record<string, unknown> | undefined) ?? {};
    const wasSkipped = typeof skippedSlice.skippedAt === "string";

    const action = decideMigrationAction(state, wasSkipped);
    if (action === "noop") {
      return { success: true };
    }
    if (action === "notice") {
      emitLingeringLegacyNotice(state);
      return { success: true };
    }

    // Need the live transport so the rewriteClaudeConfig step can wire
    // the new HTTP shape with the right port + token. If the transport
    // is offline, defer the modal — there is no useful migration we
    // can offer until the HTTP server is up.
    const transport = plugin.mcpTransportState;
    if (!transport) {
      logger.warn(
        "migration: legacy state detected but HTTP transport not running; skipping modal until next plugin load",
      );
      return { success: true };
    }

    const ctx: MigrationContext = {
      state,
      port: transport.server.port,
      token: transport.bearerToken,
      mutatePluginData: async (mutator) => {
        await globalSettingsMutex.run(async () => {
          const current = ((await plugin.loadData()) ?? {}) as Record<
            string,
            unknown
          >;
          mutator(current);
          await plugin.saveData(current);
        });
      },
    };

    const steps = planMigration(ctx);
    if (steps.length === 0) {
      // Defensive — `hasAnyLegacySignal` was true but the plan came
      // back empty (e.g. legacy binary detected without a recorded
      // path). Nothing to apply; treat as "no-op migration done".
      return { success: true };
    }

    plugin.app.workspace.onLayoutReady(() => {
      const modal = new MigrationModalHost(plugin.app, {
        state,
        steps,
        executeMigration: async (selectedIds) => {
          const results = await executeSteps(steps, selectedIds);
          const failed = results.filter((r) => !r.ok);
          if (failed.length === 0) {
            new Notice(`Migration completed (${results.length} step(s)).`);
          } else {
            new Notice(
              `Migration finished with ${failed.length} error(s). See modal for details.`,
            );
          }
          return results;
        },
        onSkip: () => {
          void persistSkipped(plugin);
        },
        onLearnMore: () => {
          openLearnMore();
        },
        onClose: () => {
          // After a completed migration we also persist the skipped
          // marker — the user has handled the legacy state, no need
          // to re-prompt next time.
          void persistSkipped(plugin);
        },
      });
      modal.open();
    });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function persistSkipped(plugin: McpToolsPlugin): Promise<void> {
  try {
    await globalSettingsMutex.run(async () => {
      const data = ((await plugin.loadData()) ?? {}) as Record<string, unknown>;
      const slice =
        (data[SKIPPED_KEY] as Record<string, unknown> | undefined) ?? {};
      await plugin.saveData({
        ...data,
        [SKIPPED_KEY]: { ...slice, skippedAt: new Date().toISOString() },
      });
    });
  } catch (err) {
    logger.warn("migration: failed to persist skipped flag", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function openLearnMore(): void {
  // Obsidian's Platform.openLink falls back to the browser; on desktop
  // it routes through `shell.openExternal` (Electron). On mobile it
  // hits the system handler.
  if (Platform.isMobile) {
    // window.open is the cross-platform path; Platform.openLink is
    // not always available on mobile sub-platforms.
    window.open(LEARN_MORE_URL, "_blank");
  } else {
    window.open(LEARN_MORE_URL, "_blank");
  }
}

export type MigrationAction = "noop" | "notice" | "modal";

/**
 * Pure decision function: given the detector result and whether the
 * user has previously dismissed the modal, returns which side-effect
 * setupMigration should run. Extracted so the policy is unit-testable
 * without filesystem mocks or Obsidian Notice / Modal instances.
 *
 * Args:
 *   state: result of detectLegacyInstall, may report zero or more signals.
 *   wasSkipped: true iff `migration.skippedAt` is set in plugin data.
 *
 * Returns:
 *   "noop"   — nothing to do (no signals, or migration already complete).
 *   "notice" — legacy state lingers AND user has dismissed; surface a
 *              non-blocking Notice each load until they remediate.
 *   "modal"  — legacy state present AND first-load decision pending;
 *              open the migration modal (subject to transport readiness
 *              checked by the caller).
 */
export function decideMigrationAction(
  state: LegacyInstallState,
  wasSkipped: boolean,
): MigrationAction {
  if (!hasAnyLegacySignal(state)) return "noop";
  if (wasSkipped) return "notice";
  return "modal";
}

/**
 * Soft signal for users who dismissed the migration modal but still
 * have legacy state on disk. Non-modal, 8s, advisory. Fork issue #78.
 */
const LINGERING_NOTICE_MS = 8000;
function emitLingeringLegacyNotice(state: LegacyInstallState): void {
  const which = lingeringSignalDescription(state);
  new Notice(
    `MCP Connector: legacy 0.3.x state still detected (${which}). Disable and re-enable the plugin to run the migration wizard.`,
    LINGERING_NOTICE_MS,
  );
  logger.info("migration: legacy state persists after dismissal", {
    which,
    skippedAfterFirstLoad: true,
  });
}

function lingeringSignalDescription(state: LegacyInstallState): string {
  const parts: string[] = [];
  if (state.hasLegacyBinary) parts.push("binary");
  if (state.hasLegacyClaudeConfigEntry) parts.push("Claude Desktop config");
  if (state.hasLegacySettingsKeys) parts.push("plugin data keys");
  return parts.length > 0 ? parts.join(", ") : "unknown";
}
