import fsp from "fs/promises";
import os from "os";
import path from "path";
import { type } from "arktype";
import {
  BINARY_NAME,
  INSTALL_PATH,
  type Platform,
} from "$/features/mcp-server-install/constants";

/**
 * Detection of leftover 0.3.x state in a fresh-load 0.4.0 vault.
 *
 * The 0.3.x plugin shipped a native `mcp-server` binary, recorded
 * `installLocation` / `platformOverride` keys in `data.json`, and wrote
 * a `mcpServers` entry into `claude_desktop_config.json` whose
 * `command` was the absolute path to that binary. The 0.4.0 plugin
 * runs the MCP server in-process and rewrites the same Claude entry
 * to use `npx mcp-remote` against `http://127.0.0.1:<port>/mcp`.
 *
 * Three independent signals tell us a legacy install is still around.
 * Any one of them is enough for the migration modal to appear:
 *
 *  1. **Legacy settings keys** — `installLocation` or `platformOverride`
 *     in `data.json`. These keys are no-ops in 0.4.0 (the install
 *     feature only consumes them through the legacy code path), so
 *     leaving them does not break the plugin, but their presence is
 *     a strong signal the user upgraded from 0.3.x.
 *  2. **Legacy binary on disk** — `mcp-server`(`.exe` on Windows) at
 *     `INSTALL_PATH[platform]`. Orphan after the upgrade. Worth
 *     ~25-50 MB. Cleanup is opt-in in the modal.
 *  3. **Legacy `claude_desktop_config.json` entry** — the
 *     `mcp-tools-istefox` entry's `command` is anything other than
 *     `npx`, OR `args` does not contain `mcp-remote`. Either means
 *     Claude Desktop is still pointing at the now-missing binary and
 *     will fail at next launch unless rewritten.
 *
 * The detection is read-only: no file is modified, no process is
 * spawned. Safe to call on every plugin load.
 */

export const legacyInstallStateSchema = type({
  hasLegacySettingsKeys: "boolean",
  hasLegacyBinary: "boolean",
  "legacyBinaryPath?": "string",
  hasLegacyClaudeConfigEntry: "boolean",
  "legacyClaudeConfigPath?": "string",
  "legacyClaudeConfigEntryCommand?": "string",
}).describe("Result of detectLegacyInstall — drives the migration modal");

export type LegacyInstallState = typeof legacyInstallStateSchema.infer;

/**
 * Inputs for `detectLegacyInstall`. Kept narrow on purpose so the
 * function stays a pure(ish) probe of the local filesystem and the
 * already-loaded plugin data — no Obsidian app reference, no transport
 * state.
 */
export type DetectLegacyInstallInput = {
  /** Result of `plugin.loadData()`. Pass-through, no mutation. */
  pluginData: unknown;
  /**
   * Plugin id used in `claude_desktop_config.json`'s `mcpServers`
   * map. Defaults to "mcp-tools-istefox" (the fork id). Override only
   * for tests against fixture configs.
   */
  pluginId?: string;
  /**
   * Absolute path to `claude_desktop_config.json`. If undefined the
   * detector resolves it from the platform default (same logic as
   * `mcp-server-install/services/config.ts:getConfigPath`).
   */
  claudeConfigPath?: string;
  /**
   * Override for the platform-specific binary install directory.
   * Tests pass a tmpdir here; production lets the function resolve
   * `INSTALL_PATH[platform]`.
   */
  binaryInstallDirOverride?: string;
};

const DEFAULT_PLUGIN_ID = "mcp-tools-istefox";

export async function detectLegacyInstall(
  input: DetectLegacyInstallInput,
): Promise<LegacyInstallState> {
  const pluginId = input.pluginId ?? DEFAULT_PLUGIN_ID;

  const hasLegacySettingsKeys = detectLegacySettingsKeys(input.pluginData);
  const binaryProbe = await probeLegacyBinary(input.binaryInstallDirOverride);
  const claudeProbe = await probeLegacyClaudeConfigEntry(
    pluginId,
    input.claudeConfigPath,
  );

  return {
    hasLegacySettingsKeys,
    hasLegacyBinary: binaryProbe.exists,
    ...(binaryProbe.exists && binaryProbe.fullPath
      ? { legacyBinaryPath: binaryProbe.fullPath }
      : {}),
    hasLegacyClaudeConfigEntry: claudeProbe.isLegacy,
    ...(claudeProbe.configPath
      ? { legacyClaudeConfigPath: claudeProbe.configPath }
      : {}),
    ...(claudeProbe.entryCommand !== undefined
      ? { legacyClaudeConfigEntryCommand: claudeProbe.entryCommand }
      : {}),
  };
}

/**
 * Convenience helper: returns true if any of the three signals fired.
 * Drives the show/hide of the migration modal.
 */
export function hasAnyLegacySignal(state: LegacyInstallState): boolean {
  return (
    state.hasLegacySettingsKeys ||
    state.hasLegacyBinary ||
    state.hasLegacyClaudeConfigEntry
  );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function detectLegacySettingsKeys(pluginData: unknown): boolean {
  if (!pluginData || typeof pluginData !== "object") return false;
  const d = pluginData as Record<string, unknown>;
  return "installLocation" in d || "platformOverride" in d;
}

async function probeLegacyBinary(
  installDirOverride?: string,
): Promise<{ exists: boolean; fullPath?: string }> {
  const platform = currentPlatform();
  if (!platform) return { exists: false };

  const dir = installDirOverride ?? expandHomePath(INSTALL_PATH[platform]);
  const fullPath = path.join(dir, BINARY_NAME[platform]);

  try {
    const stat = await fsp.stat(fullPath);
    if (stat.isFile()) return { exists: true, fullPath };
    return { exists: false };
  } catch (err) {
    // ENOENT is the common case; any other error (EACCES, EIO …) we
    // treat as "no detectable legacy binary" — the migration modal is
    // an optional UX surface, not a security boundary.
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { exists: false };
    }
    return { exists: false };
  }
}

type ClaudeProbeResult = {
  isLegacy: boolean;
  configPath?: string;
  entryCommand?: string;
};

async function probeLegacyClaudeConfigEntry(
  pluginId: string,
  configPathOverride?: string,
): Promise<ClaudeProbeResult> {
  const configPath = configPathOverride ?? defaultClaudeConfigPath();
  if (!configPath) return { isLegacy: false };

  let raw: string;
  try {
    raw = await fsp.readFile(configPath, "utf8");
  } catch {
    // Missing config file → user has never configured Claude Desktop
    // OR they only use HTTP-native clients (Claude Code, Cursor …).
    // No legacy entry to migrate.
    return { isLegacy: false, configPath };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Malformed config — leave it alone. Migration requires a
    // confidently-parsed file; a corrupt one needs human attention.
    return { isLegacy: false, configPath };
  }

  if (!parsed || typeof parsed !== "object") {
    return { isLegacy: false, configPath };
  }
  const cfg = parsed as Record<string, unknown>;
  const servers = cfg.mcpServers;
  if (!servers || typeof servers !== "object") {
    return { isLegacy: false, configPath };
  }

  const entry = (servers as Record<string, unknown>)[pluginId];
  if (!entry || typeof entry !== "object") {
    return { isLegacy: false, configPath };
  }

  const e = entry as Record<string, unknown>;
  const command = typeof e.command === "string" ? e.command : "";
  const args = Array.isArray(e.args) ? (e.args as unknown[]) : [];

  // 0.4.0 shape: command="npx", args contains the literal "mcp-remote".
  // Anything else is legacy. Two literal checks are enough — we don't
  // need to validate the full new shape here, only recognize that the
  // entry has been moved off the binary path.
  const usesNpx = command === "npx";
  const usesMcpRemote = args.some(
    (a) => typeof a === "string" && a === "mcp-remote",
  );
  const isLegacy = !(usesNpx && usesMcpRemote);

  return {
    isLegacy,
    configPath,
    entryCommand: command || undefined,
  };
}

function currentPlatform(): Platform | null {
  switch (os.platform()) {
    case "darwin":
      return "macos";
    case "win32":
      return "windows";
    case "linux":
      return "linux";
    default:
      return null;
  }
}

/**
 * Mirrors `mcp-server-install/services/status.ts:expandHomePath`.
 * Duplicated here (rather than imported) because that module pulls in
 * the macro-using install constants and we want this detection module
 * to stay light. Keep the two in sync if either evolves.
 */
function expandHomePath(template: string): string {
  let expanded = template;
  if (expanded.startsWith("~")) {
    expanded = path.join(os.homedir(), expanded.slice(1));
  }
  expanded = expanded.replace(
    /%([^%]+)%/g,
    (_, name) => process.env[name] || "",
  );
  return expanded;
}

function defaultClaudeConfigPath(): string | undefined {
  const platform = currentPlatform();
  if (!platform) return undefined;
  const map = {
    macos: "~/Library/Application Support/Claude/claude_desktop_config.json",
    windows: "%APPDATA%\\Claude\\claude_desktop_config.json",
    linux: "~/.config/Claude/claude_desktop_config.json",
  } as const;
  return expandHomePath(map[platform]);
}
