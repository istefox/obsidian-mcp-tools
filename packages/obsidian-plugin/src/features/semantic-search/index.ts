import { type } from "arktype";
import type McpToolsPlugin from "$/main";
import { createMutex, type Mutex } from "$/features/command-permissions";
import { logger } from "$/shared/logger";
import {
  DEFAULT_SEMANTIC_SETTINGS,
  semanticSearchSettingsSchema,
  type SemanticSearchSettings,
} from "./types";

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
  teardown: () => Promise<void>;
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

export async function setup(plugin: McpToolsPlugin): Promise<SetupResult> {
  try {
    const settingsMutex = createMutex();
    const settings = await loadAndPersistSettings(plugin, settingsMutex);

    // Phase 3 T2: settings loaded under mutex. Provider remains a
    // no-op until T6/T7/T8 land. The factory will read `settings`
    // and return the right provider then.
    const state: SemanticSearchState = {
      provider: new NoopProvider(),
      settings,
      settingsMutex,
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
