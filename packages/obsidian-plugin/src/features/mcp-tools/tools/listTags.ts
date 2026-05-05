import { type } from "arktype";
import type { App } from "obsidian";

export const listTagsSchema = type({
  name: '"list_tags"',
  arguments: {
    "sort?": type('"name" | "count"').describe(
      "Sort by tag name (alphabetical, ascending) or by usage count (descending). Defaults to 'count'.",
    ),
  },
}).describe(
  "Lists all tags used across the vault with their usage counts. Aggregates both inline `#tags` and frontmatter tags via Obsidian's metadata cache. Useful for discovering content categories, finding related notes, and understanding vault organization. Always read-only.",
);

export type ListTagsContext = {
  arguments: { sort?: "name" | "count" };
  app: App;
};

export async function listTagsHandler(
  ctx: ListTagsContext,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  // `MetadataCache.getTags()` returns a `Record<string, number>` keyed by
  // tag (with the leading `#`), value = aggregated count across the vault.
  // The signature is part of Obsidian's public API but the cast through
  // `unknown` keeps us aligned with the codebase pattern used for other
  // metadata-cache accessors that the bundled `obsidian.d.ts` does not
  // surface directly (see listObsidianCommands.ts).
  const tagCounts = (
    ctx.app.metadataCache as unknown as {
      getTags: () => Record<string, number>;
    }
  ).getTags();

  const sortMode = ctx.arguments.sort ?? "count";
  const sorted = Object.entries(tagCounts).sort((a, b) =>
    sortMode === "name" ? a[0].localeCompare(b[0]) : b[1] - a[1],
  );

  const output = {
    totalTags: sorted.length,
    tags: sorted.map(([tag, count]) => ({ tag, count })),
  };

  return {
    content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
  };
}
