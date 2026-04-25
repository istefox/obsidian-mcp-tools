/**
 * Shared helpers for patch operations (heading resolution, body normalization,
 * block reference lookup). Pure functions — no Obsidian API calls here.
 *
 * Used by patch_active_file (T6) and patch_vault_file (T13).
 */

import type { App, TFile } from "obsidian";

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

// === PatchArgs type and applyPatch function (shared by T6 and T13) ===

export type PatchArgs = {
  operation: PatchOperation;
  targetType: "heading" | "block" | "frontmatter";
  target: string;
  content: string;
  targetDelimiter?: string;
  createTargetIfMissing?: boolean;
};

/**
 * Apply a patch operation (append/prepend/replace) to a vault file using the
 * native Obsidian API. Handles three target types:
 *
 * - **heading**: finds the section bounded by the target heading and the next
 *   sibling/parent heading, then inserts or replaces content in that region.
 *   If the heading is not found and `createTargetIfMissing` is true (default),
 *   the content is appended at EOF.
 * - **block**: looks up the block `^id` via metadataCache (preferred) or regex
 *   fallback. Returns an error if not found and `createTargetIfMissing` is
 *   false (the default for blocks — see upstream issue #71).
 * - **frontmatter**: uses `app.fileManager.processFrontMatter` to mutate the
 *   requested key according to the operation.
 *
 * Args:
 *   app: Obsidian App instance.
 *   file: The TFile to patch.
 *   args: Patch parameters (operation, targetType, target, content, …).
 *
 * Returns:
 *   An MCP-shaped result object. Sets `isError: true` on failure.
 */
export async function applyPatch(
  app: App,
  file: TFile,
  args: PatchArgs,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  const targetDelimiter = args.targetDelimiter ?? "::";
  // Default createTargetIfMissing: true for heading/frontmatter, false for block
  // (see upstream issue #71 — block in table is not indexed by metadataCache).
  const defaultCreate = args.targetType !== "block";
  const createIfMissing = args.createTargetIfMissing ?? defaultCreate;

  // ── frontmatter branch ──────────────────────────────────────────────────
  if (args.targetType === "frontmatter") {
    await app.fileManager.processFrontMatter(file, (fm) => {
      const existing = fm[args.target];
      if (args.operation === "replace") {
        fm[args.target] = args.content;
      } else if (args.operation === "append") {
        fm[args.target] =
          existing != null ? String(existing) + args.content : args.content;
      } else {
        // prepend
        fm[args.target] =
          existing != null ? args.content + String(existing) : args.content;
      }
    });
    return { content: [{ type: "text", text: "File patched successfully" }] };
  }

  // ── heading / block branch — read raw content ────────────────────────
  const rawContent = await app.vault.read(file);
  const lines = rawContent.split("\n");

  if (args.targetType === "heading") {
    // Resolve partial leaf name to full hierarchical path so the lookup
    // matches even when the heading is nested (e.g. "A" → "Top::A").
    let resolvedTarget = args.target;
    if (!args.target.includes(targetDelimiter)) {
      const fullPath = resolveHeadingPath(rawContent, args.target, targetDelimiter);
      if (fullPath) resolvedTarget = fullPath;
    }

    // Find the heading line by comparing the full path.
    const targetParts = resolvedTarget.split(targetDelimiter);
    const leafHeading = targetParts[targetParts.length - 1];
    let headingLine = -1;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^(#{1,6})\s+(.+)$/);
      if (m && m[2].trim() === leafHeading) {
        headingLine = i;
        break;
      }
    }

    if (headingLine === -1) {
      // Heading not found — respect createTargetIfMissing.
      if (!createIfMissing) {
        return {
          content: [{ type: "text", text: `Heading not found: ${args.target}` }],
          isError: true,
        };
      }
      // Append at EOF.
      const body = normalizeAppendBody(args.content, args.operation);
      await app.vault.modify(file, rawContent + body);
      return { content: [{ type: "text", text: "File patched successfully" }] };
    }

    // Find the end of this heading's section: the next heading of same or
    // higher level (lower number means higher in hierarchy), or EOF.
    const headingLevel = (lines[headingLine].match(/^(#+)/))?.[1].length ?? 1;
    let sectionEnd = lines.length; // exclusive index of last section line
    for (let i = headingLine + 1; i < lines.length; i++) {
      const m = lines[i].match(/^(#{1,6})\s/);
      if (m && m[1].length <= headingLevel) {
        sectionEnd = i;
        break;
      }
    }

    // The section body is the lines between the heading and the next heading.
    // We want to insert content just before sectionEnd (append) or just after
    // headingLine (prepend) or replace the whole body (replace).
    const body = normalizeAppendBody(args.content, args.operation);
    let newLines: string[];
    if (args.operation === "replace") {
      newLines = [
        ...lines.slice(0, headingLine + 1),
        body,
        ...lines.slice(sectionEnd),
      ];
    } else if (args.operation === "prepend") {
      newLines = [
        ...lines.slice(0, headingLine + 1),
        body,
        ...lines.slice(headingLine + 1),
      ];
    } else {
      // append — insert before the next heading (sectionEnd)
      newLines = [
        ...lines.slice(0, sectionEnd),
        body,
        ...lines.slice(sectionEnd),
      ];
    }
    await app.vault.modify(file, newLines.join("\n"));
    return { content: [{ type: "text", text: "File patched successfully" }] };
  }

  // ── block branch ─────────────────────────────────────────────────────
  const cache = app.metadataCache.getFileCache(file);
  let blockPos = findBlockPositionFromCache(cache, args.target);

  if (!blockPos) {
    // Fallback: regex scan (doesn't work for blocks inside tables — #71).
    blockPos = findBlockReferenceInContent(rawContent, args.target);
  }

  if (!blockPos) {
    // Block not found — for blocks the default is fail-loud (createIfMissing=false).
    if (!createIfMissing) {
      return {
        content: [
          {
            type: "text",
            text: `Block not found: ^${args.target} (unresolved — block may be inside a table, which is not indexed by Obsidian's metadataCache)`,
          },
        ],
        isError: true,
      };
    }
    // Caller explicitly opted into createIfMissing — append at EOF.
    const body = normalizeAppendBody(args.content, args.operation);
    await app.vault.modify(file, rawContent + body);
    return { content: [{ type: "text", text: "File patched successfully" }] };
  }

  // Apply operation to the block region.
  const body = normalizeAppendBody(args.content, args.operation);
  let newLines: string[];
  if (args.operation === "replace") {
    // Replace the block lines entirely (keeps the ^id marker on last line only
    // if the new content doesn't already include it — here we strip the old
    // marker and let the caller own the new content verbatim).
    newLines = [
      ...lines.slice(0, blockPos.startLine),
      body,
      ...lines.slice(blockPos.endLine + 1),
    ];
  } else if (args.operation === "prepend") {
    newLines = [
      ...lines.slice(0, blockPos.startLine),
      body,
      ...lines.slice(blockPos.startLine),
    ];
  } else {
    // append — insert after the last line of the block
    newLines = [
      ...lines.slice(0, blockPos.endLine + 1),
      body,
      ...lines.slice(blockPos.endLine + 1),
    ];
  }
  await app.vault.modify(file, newLines.join("\n"));
  return { content: [{ type: "text", text: "File patched successfully" }] };
