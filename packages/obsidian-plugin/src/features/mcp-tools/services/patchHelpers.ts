/**
 * Shared helpers for patch operations (heading resolution, body normalization,
 * block reference lookup). Pure functions — no Obsidian API calls here.
 *
 * Used by patch_active_file (T6) and patch_vault_file (T13).
 */

export type PatchOperation = "append" | "prepend" | "replace";

/**
 * Parse markdown content and resolve a partial heading name to its full
 * hierarchical path (e.g., "Section A" -> "Top Level::Section A"). Returns
 * the full path of the first matching heading by document order, or null
 * if no heading with that exact name exists in the content.
 *
 * Ported verbatim from packages/mcp-server/src/features/local-rest-api/index.ts.
 *
 * Args:
 *   content: Full markdown file content as a string.
 *   leafName: Exact heading text to search for (without leading #).
 *   delimiter: Separator used to join the ancestor chain (e.g. "::").
 *
 * Returns:
 *   The full hierarchical path string, or null if no match found.
 */
export function resolveHeadingPath(
  content: string,
  leafName: string,
  delimiter: string,
): string | null {
  const lines = content.split("\n");
  // Stack of heading names at each indentation level. stack[level-1] holds
  // the name of the heading at that level. When we encounter a heading at
  // level N, all deeper levels become stale and are truncated.
  const stack: string[] = [];

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (!match) continue;
    const level = match[1].length;
    const headingText = match[2].trim();

    // Drop any stack entries deeper than the current level, then set the
    // current level's slot. This keeps `stack.slice(0, level)` a valid
    // ancestor path for any subsequent match at a deeper level.
    stack.length = level - 1;
    stack[level - 1] = headingText;

    if (headingText === leafName) {
      // Join the full ancestor chain (including the match itself) with the
      // delimiter the caller will also pass as the Target-Delimiter header.
      return stack.slice(0, level).join(delimiter);
    }
  }

  return null;
}

/**
 * Ensure appended content ends with whitespace so the next section in the
 * document remains visually separated. markdown-patch does not insert any
 * separation on its own, so `**bold**` appended under a heading would
 * collide with the following `## Next Heading` line.
 *
 * Only modifies content when operation is "append" and content does not
 * already end with a newline.
 *
 * Args:
 *   content: The body text to be patched into the document.
 *   operation: The patch operation type.
 *
 * Returns:
 *   The content, possibly with "\n\n" appended.
 */
export function normalizeAppendBody(
  content: string,
  operation: PatchOperation,
): string {
  if (operation === "append" && !content.endsWith("\n")) {
    return content + "\n\n";
  }
  return content;
}

/**
 * Find a block reference (^id) in markdown content via regex. Used as a
 * fallback when Obsidian's metadataCache hasn't indexed the file yet.
 *
 * Walks the lines looking for a line that is exactly `^blockId` (after
 * trimming trailing whitespace). When found, walks backwards to find the
 * start of the containing paragraph (stops at empty lines).
 *
 * Args:
 *   content: Full markdown file content as a string.
 *   blockId: The block identifier to look for (without the leading ^).
 *
 * Returns:
 *   An object with startLine and endLine (0-indexed), or null if not found.
 */
export function findBlockReferenceInContent(
  content: string,
  blockId: string,
): { startLine: number; endLine: number } | null {
  const lines = content.split("\n");
  const blockMarker = `^${blockId}`;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimEnd() === blockMarker) {
      // Block markers point to the preceding paragraph.
      // Walk backwards to find the start of the block.
      let start = i;
      while (start > 0 && lines[start - 1].trim() !== "") {
        start--;
      }
      return { startLine: start, endLine: i };
    }
  }
  return null;
}

/**
 * Find a block reference position from Obsidian's metadataCache. Preferred
 * over `findBlockReferenceInContent` because it respects the markdown-patch
 * indexer's block detection rules (e.g., does not search inside markdown
 * tables — see upstream issue #71). Returns null on miss; callers MUST
 * decide whether to fail loud or fall back to EOF append based on the
 * `createTargetIfMissing` flag.
 *
 * Args:
 *   cache: An Obsidian CachedMetadata-shaped object (or null/undefined).
 *   blockId: The block identifier to look up (without the leading ^).
 *
 * Returns:
 *   An object with startLine and endLine (0-indexed), or null if not found.
 */
export function findBlockPositionFromCache(
  cache:
    | {
        blocks?: Record<
          string,
          { position: { start: { line: number }; end: { line: number } } }
        >;
      }
    | null
    | undefined,
  blockId: string,
): { startLine: number; endLine: number } | null {
  if (!cache?.blocks) return null;
  const entry = cache.blocks[blockId];
  if (!entry) return null;
  return {
    startLine: entry.position.start.line,
    endLine: entry.position.end.line,
  };
}
