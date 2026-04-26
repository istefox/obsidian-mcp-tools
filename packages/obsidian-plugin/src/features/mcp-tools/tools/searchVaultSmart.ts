import { type } from "arktype";
import type { App } from "obsidian";
import type McpToolsPlugin from "$/main";
import type { SmartConnections } from "shared";
import { mapFolderFilter } from "$/features/semantic-search/services/smartConnectionsProvider";

export const searchVaultSmartSchema = type({
  name: '"search_vault_smart"',
  arguments: {
    query: type("string>0").describe(
      "Natural-language search phrase. Returns notes ranked by semantic similarity.",
    ),
    "filter?": {
      "includeFolders?": type("string[]").describe(
        "Restrict results to notes whose path starts with one of these folder prefixes.",
      ),
      "excludeFolders?": type("string[]").describe(
        "Skip notes whose path starts with one of these folder prefixes.",
      ),
    },
    "limit?": type("number.integer>=1").describe(
      "Maximum number of results to return. Default 10.",
    ),
  },
}).describe(
  "Semantic search via the Smart Connections plugin. Requires Smart Connections to be installed and indexed. Returns notes ranked by similarity to the query.",
);

export type SearchVaultSmartContext = {
  arguments: {
    query: string;
    filter?: { includeFolders?: string[]; excludeFolders?: string[] };
    limit?: number;
  };
  app: App;
  plugin: McpToolsPlugin;
};

type SmartSearchResult = {
  item: {
    path: string;
    breadcrumbs?: string;
    read: () => Promise<string>;
  };
  score: number;
};

/**
 * Retrieve the SmartSearch API from the plugin instance.
 *
 * The field `plugin.smartSearch` is injected by the feature setup
 * (and overridable in tests via `mockPlugin`). It holds a
 * `SmartConnections.SmartSearch`-compatible object. We read it through
 * an `unknown` cast so we don't widen `McpToolsPlugin`'s public type
 * here — the feature setup is the canonical place for that declaration.
 */
function getSmartSearch(
  plugin: McpToolsPlugin,
): SmartConnections.SmartSearch | undefined {
  return (
    plugin as unknown as { smartSearch?: SmartConnections.SmartSearch }
  ).smartSearch;
}

/**
 * Handler for the `search_vault_smart` MCP tool.
 *
 * Bypasses the Local REST API `/search/smart` HTTP endpoint and calls
 * the Smart Connections plugin API directly in-process, avoiding the
 * HTTP round-trip overhead and the need for Local REST API to be running.
 *
 * Filter mapping (user-facing camelCase → SmartSearch snake_case):
 *   includeFolders → key_starts_with_any
 *   excludeFolders → exclude_key_starts_with_any
 *   limit          → limit
 */
export async function searchVaultSmartHandler(
  ctx: SearchVaultSmartContext,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: true }> {
  const smartSearch = getSmartSearch(ctx.plugin);

  if (!smartSearch) {
    return {
      content: [
        {
          type: "text",
          text: "Smart Connections plugin is not installed or not yet loaded with an indexed vault. Install Smart Connections from Obsidian community plugins, let it index, then retry.",
        },
      ],
      isError: true,
    };
  }

  // Filter mapping (camelCase tool args → SmartSearch snake_case)
  // lives in the SmartConnectionsProvider so the same conversion is
  // shared with the Phase 3 provider abstraction. T11 will replace
  // this direct call with `plugin.semanticSearchState.provider.search`.
  const filter = mapFolderFilter({
    folders: ctx.arguments.filter?.includeFolders,
    excludeFolders: ctx.arguments.filter?.excludeFolders,
    limit: ctx.arguments.limit,
  });

  const rawResults = await smartSearch.search(
    ctx.arguments.query,
    filter as Parameters<SmartConnections.SmartSearch["search"]>[1],
  );

  // Materialise note content for each result. The SmartSearch API returns
  // lazy `read()` methods — we await them here so the MCP client gets
  // self-contained text without needing a follow-up vault read call.
  const results = await Promise.all(
    (rawResults as SmartSearchResult[]).map(async (r) => ({
      path: r.item.path,
      score: r.score,
      breadcrumbs: r.item.breadcrumbs,
      text: await r.item.read(),
    })),
  );

  return {
    content: [{ type: "text", text: JSON.stringify({ results }, null, 2) }],
  };
}
