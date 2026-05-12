import { type } from "arktype";
import type { App, TFile } from "obsidian";

export const getRecentFilesSchema = type({
  name: '"get_recent_files"',
  arguments: {
    "limit?": type("1<=number.integer<=100").describe(
      "Maximum number of files to return (1-100, default 20). Values outside this range, zero, negative, or non-integer numbers are rejected at schema validation.",
    ),
  },
}).describe(
  "Returns the most recently modified markdown files in the vault, ordered by `mtime` descending. Each entry includes `path`, `mtime`, `ctime` (Unix epoch milliseconds), and `size` (bytes). Honours Obsidian's `Files & Links → Excluded files` configuration via `MetadataCache.isUserIgnored`; markdown-only via `vault.getMarkdownFiles()`. Useful for agent-recency context. Always read-only.",
);

export type GetRecentFilesContext = {
  arguments: { limit?: number };
  app: App;
};

export async function getRecentFilesHandler(
  ctx: GetRecentFilesContext,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const limit = ctx.arguments.limit ?? 20;

  // `MetadataCache.isUserIgnored(path)` is part of Obsidian's runtime API
  // but is not surfaced by the bundled `obsidian.d.ts`. The cast through
  // `unknown` keeps us aligned with the codebase pattern used for other
  // metadata-cache accessors (see listTags.ts:30). Treated as optional so
  // tests that do not stub it keep working.
  const isUserIgnored = (
    ctx.app.metadataCache as unknown as {
      isUserIgnored?: (path: string) => boolean;
    }
  ).isUserIgnored?.bind(ctx.app.metadataCache);

  const allMarkdown = ctx.app.vault.getMarkdownFiles();
  const visible = isUserIgnored
    ? allMarkdown.filter((f: TFile) => !isUserIgnored(f.path))
    : allMarkdown;

  // `totalFiles` reports the size of the visible (post-exclusion) set,
  // before the recency slice. Matches the contract of `get_files_by_tag`
  // where `totalFiles` is the total match count, not the page size.
  const totalFiles = visible.length;

  const files = visible
    .slice()
    .sort((a, b) => b.stat.mtime - a.stat.mtime)
    .slice(0, limit)
    .map((f) => ({
      path: f.path,
      mtime: f.stat.mtime,
      ctime: f.stat.ctime,
      size: f.stat.size,
    }));

  const output = { totalFiles, files };

  return {
    content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
  };
}
