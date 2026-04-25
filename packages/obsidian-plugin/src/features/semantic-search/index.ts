import type McpToolsPlugin from "$/main";

/**
 * Semantic search feature — Phase 3 scaffolding.
 *
 * The full provider/indexer pipeline lands in T2-T15 of
 * `docs/plans/0.4.0-phase-3-semantic-search.md`. This entry point
 * currently installs a no-op provider so `searchVaultSmart` can
 * dispatch through `plugin.semanticSearch.provider` without breaking
 * once T11 wires the tool handler. Until T6/T7 land, the no-op
 * provider returns `isReady: false` and an actionable error message
 * — same behavior the user gets today when Smart Connections is
 * missing, so this is a strict no-regression scaffolding step.
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
  teardown: () => Promise<void>;
};

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

export async function setup(_plugin: McpToolsPlugin): Promise<SetupResult> {
  // Phase 3 T1: scaffolding only. Real provider/indexer lifecycle
  // arrives with T2-T15.
  const state: SemanticSearchState = {
    provider: new NoopProvider(),
    teardown: async () => {
      // No-op for now. T9/T10 add indexer flush + model unload here.
    },
  };
  return { success: true, state };
}

export async function teardown(state: SemanticSearchState): Promise<void> {
  await state.teardown();
}
