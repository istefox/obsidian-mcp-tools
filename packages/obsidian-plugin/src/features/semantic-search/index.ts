import { type } from "arktype";
import type McpToolsPlugin from "$/main";
import { createMutex, type Mutex } from "$/features/command-permissions";
import { logger } from "$/shared/logger";
import {
  DEFAULT_SEMANTIC_SETTINGS,
  semanticSearchSettingsSchema,
  type SemanticSearchSettings,
} from "./types";
import {
  createProviderFactory,
  type ProviderChooser,
  type ProviderFactoryDeps,
} from "./services/providerFactory";

export { default as FeatureSettings } from "./components/SemanticSettingsSection.svelte";

/**
 * Semantic search feature — Phase 3 scaffolding.
 *
 * The full provider/indexer pipeline lands in T2-T15 of
 * `docs/plans/0.4.0-phase-3-semantic-search.md`. This entry point
 * currently installs a no-op provider so `searchVaultSmart` can
 * dispatch through `plugin.semanticSearchState.provider` without
 * breaking once T11 wires the tool handler. Until T6/T7 land, the
 * no-op provider returns `isReady: false` and an actionable error
 * message — strict no-regression scaffolding.
 *
 * T2 adds the settings block: tri-state provider + indexing mode +
 * unload-when-idle, persisted via `plugin.saveData` under a feature
 * mutex (load → modify → save serialized to avoid the non-atomic
 * loadData/saveData trap documented in CLAUDE.md § Gotchas).
 */

export type SearchOpts = {
  folders?: readonly string[];
  excludeFolders?: readonly string[];
  limit?: number;
};

export type SearchResult = {
  filePath: string;
  heading: string | null;
  excerpt: string;
  score: number;
};

export interface SemanticSearchProvider {
  search(query: string, opts: SearchOpts): Promise<SearchResult[]>;
  isReady(): boolean;
}

export type SemanticSearchState = {
  provider: SemanticSearchProvider;
  settings: SemanticSearchSettings;
  settingsMutex: Mutex;
  /**
   * Closure mapping `SemanticSearchSettings` to the matching
   * provider. Present iff `setup()` was called with `factoryDeps`.
   * The settings UI (T12) calls this on a tri-state change to swap
   * `state.provider` without rebuilding the embedder/store.
   */
  chooser: ProviderChooser | null;
  teardown: () => Promise<void>;
};

export type SemanticSearchSetupOpts = {
  /**
   * Provider factory dependencies. When supplied, `setup` constructs
   * a real provider via the factory and exposes the chooser closure.
   * When omitted, the state stays on the NoopProvider — useful for
   * the early plugin lifecycle and for tests that want to exercise
   * settings persistence in isolation.
   */
  factoryDeps?: ProviderFactoryDeps;
};

/**
 * Load settings, merge any missing keys with DEFAULT_SEMANTIC_SETTINGS,
 * persist the merged result if it differs from what was on disk, and
 * return the canonical settings object.
 *
 * Held under the feature mutex: `plugin.loadData` and `plugin.saveData`
 * are not atomic at the plugin level, and any concurrent feature that
 * reads-modifies-writes its own settings slice must serialize its own
 * I/O to avoid lost-update races.
 */
async function loadAndPersistSettings(
  plugin: McpToolsPlugin,
  mutex: Mutex,
): Promise<SemanticSearchSettings> {
  return mutex.run(async () => {
    const data = ((await plugin.loadData()) as Record<string, unknown>) ?? {};
    const stored = data.semanticSearch as Partial<SemanticSearchSettings> | undefined;

    const merged: SemanticSearchSettings = {
      ...DEFAULT_SEMANTIC_SETTINGS,
      ...(stored ?? {}),
    };

    const validated = semanticSearchSettingsSchema(merged);
    if (validated instanceof type.errors) {
      // Settings on disk are malformed — fall back to defaults but log
      // so the user can find out via plugin logs why their tweaks were
      // ignored. Never throw: a corrupt settings field must not crash
      // the plugin onload.
      logger.warn("semantic-search settings invalid, using defaults", {
        summary: validated.summary,
        stored,
      });
      const defaults = { ...DEFAULT_SEMANTIC_SETTINGS };
      data.semanticSearch = defaults;
      await plugin.saveData(data);
      return defaults;
    }

    // Persist iff the merge added defaults that weren't on disk.
    const needsPersist =
      stored === undefined ||
      JSON.stringify(stored) !== JSON.stringify(validated);
    if (needsPersist) {
      data.semanticSearch = validated;
      await plugin.saveData(data);
    }

    return validated;
  });
}

class NoopProvider implements SemanticSearchProvider {
  async search(): Promise<SearchResult[]> {
    throw new Error(
      "Semantic search provider not configured. Open Settings → MCP Connector → Semantic Search to choose a provider.",
    );
  }
  isReady(): boolean {
    return false;
  }
}

export type SetupResult =
  | { success: true; state: SemanticSearchState }
  | { success: false; error: string };

export async function setup(
  plugin: McpToolsPlugin,
  opts: SemanticSearchSetupOpts = {},
): Promise<SetupResult> {
  try {
    const settingsMutex = createMutex();
    const settings = await loadAndPersistSettings(plugin, settingsMutex);

    // Phase 3 T8: if factoryDeps is supplied, construct the chooser
    // and pick the provider matching the user's tri-state setting.
    // Without deps, the state holds a NoopProvider; T11 will supply
    // the real deps from main.ts after the embedder + store are
    // wired up against the live vault.
    let provider: SemanticSearchProvider;
    let chooser: ProviderChooser | null = null;
    if (opts.factoryDeps) {
      chooser = createProviderFactory(opts.factoryDeps);
      provider = chooser(settings);
    } else {
      provider = new NoopProvider();
    }

    const state: SemanticSearchState = {
      provider,
      settings,
      settingsMutex,
      chooser,
      teardown: async () => {
        // No-op for now. T9/T10 add indexer flush + model unload here.
      },
    };
    return { success: true, state };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

export async function teardown(state: SemanticSearchState): Promise<void> {
  await state.teardown();
}

/**
 * Persist a new SemanticSearchSettings value and swap the live
 * provider via the chooser closure when one is available.
 *
 * Used by the settings UI (T12) on tri-state / mode / unload-toggle
 * change. Held under the feature mutex so a rapid double-toggle
 * cannot land out-of-order writes against `data.json`.
 */
export async function applySettings(
  plugin: McpToolsPlugin,
  state: SemanticSearchState,
  next: SemanticSearchSettings,
): Promise<void> {
  await state.settingsMutex.run(async () => {
    const data = ((await plugin.loadData()) as Record<string, unknown>) ?? {};
    data.semanticSearch = next;
    await plugin.saveData(data);
  });
  state.settings = next;
  if (state.chooser) {
    state.provider = state.chooser(next);
  }
}
