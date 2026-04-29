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

// === Frontmatter plan helpers (shared by T6 and T13) ============================
//
// Pure / synchronous decision functions that decide what to do when a
// `targetType: "frontmatter"` patch lands on a field. They exist as separate,
// unit-testable helpers because the frontmatter branch of `applyPatch` is a
// known regression hotspot (issues #12 / #13 on the istefox fork): the 0.3.x
// line had to add hardening against silent array→scalar coercion and against
// HTTP-500-on-JSON-scalar; the 0.4.0 in-process port was a fresh write and
// missed both. Putting the policy in pure helpers keeps the regression tests
// simple and the production branch a thin dispatch.

/**
 * Decision returned by `planFrontmatterReplace`.
 *
 * - `ok` — caller should assign `value` (which is either `null` or an array)
 *   to the frontmatter field.
 * - `ok-string` — existing field is not array-shaped, so the safe behaviour
 *   is to assign `args.content` verbatim (the legacy scalar-replace path).
 * - `reject` — refuse the call with `message`. Used for the array+scalar
 *   mismatch that previously corrupted data silently.
 */
export type FrontmatterReplacePlan =
  | { kind: "ok"; value: unknown }
  | { kind: "ok-string" }
  | { kind: "reject"; message: string };

/**
 * Decide what `replace` should do against an existing frontmatter value.
 *
 * Policy (reverse-engineered from the 0.3.8 hardening + adapted to the
 * in-process flow that no longer carries a `contentType` parameter):
 *
 * - existing is **not array** → caller assigns `content` as a string.
 * - existing **is array** + `content` is JSON-decodable as `null` or an
 *   array → caller assigns the parsed value (preserves array shape, or
 *   clears the field via `null`).
 * - existing **is array** + anything else → reject with an actionable
 *   message that names the JSON forms the caller should use.
 *
 * Closes folotp's #12: prior to this, `replace` on an array-valued field
 * with a plain string content silently coerced the field to a scalar and
 * destroyed the array.
 *
 * Args:
 *   existing: The current value of `fm[target]` as read by `processFrontMatter`.
 *   content: The raw `content` string supplied by the MCP caller.
 *   target: The frontmatter key — only used to build the rejection message.
 *
 * Returns:
 *   A `FrontmatterReplacePlan` describing the next step.
 */
export function planFrontmatterReplace(
  existing: unknown,
  content: string,
  target: string,
): FrontmatterReplacePlan {
  if (!Array.isArray(existing)) {
    return { kind: "ok-string" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { kind: "reject", message: arrayMismatchMessage(target) };
  }
  if (parsed === null || Array.isArray(parsed)) {
    return { kind: "ok", value: parsed };
  }
  return { kind: "reject", message: arrayMismatchMessage(target) };
}

function arrayMismatchMessage(target: string): string {
  return (
    `Refusing to replace array-valued frontmatter field "${target}" ` +
    `with a scalar value: this would silently destroy the existing array ` +
    `structure. Pass content as a JSON-encoded value — for example ` +
    `'["new"]' to set a single-element array, ` +
    `'["a","b"]' for multiple elements, or ` +
    `'null' to clear the field.`
  );
}

/**
 * Decision returned by `planFrontmatterAppend`.
 *
 * - `array-push` — existing field is array; `values` should be pushed
 *   (`append`) or unshifted (`prepend`) into a copy of it.
 * - `string-concat` — existing field is scalar/null/undefined; the caller
 *   falls back to the legacy `String(existing) + content` path.
 */
export type FrontmatterAppendPlan =
  | { kind: "array-push"; values: unknown[] }
  | { kind: "string-concat" };

/**
 * Decide what `append` / `prepend` should do against an existing frontmatter
 * value. Symmetric to `planFrontmatterReplace`, but never rejects: append on
 * an array has one reasonable interpretation in every input shape.
 *
 * Policy:
 *
 * - existing is **not array** → caller falls back to string concatenation.
 * - existing **is array** + `content` is JSON-decodable as an array →
 *   spread the parsed array's elements.
 * - existing **is array** + `content` is JSON-decodable as a scalar →
 *   push that single parsed scalar (matches the 0.3.8 auto-wrap fix from
 *   `coerceFrontmatterAppendArrayContent`).
 * - existing **is array** + `content` is **not** valid JSON → push the raw
 *   content as a single string element. This is the "DWIM where there is
 *   one reasonable interpretation" branch: an LLM caller that does not
 *   know about JSON encoding will just send `"new-tag"` and reasonably
 *   expect it to land in the array.
 *
 * Closes folotp's #13: prior to this, append/prepend on an array-valued
 * field flattened the array via `String(existing) + content`, producing
 * comma-joined corruption like `tags: existing,new-tag"new-tag"`.
 *
 * Args:
 *   existing: The current value of `fm[target]` as read by `processFrontMatter`.
 *   content: The raw `content` string supplied by the MCP caller.
 *
 * Returns:
 *   A `FrontmatterAppendPlan` describing the next step.
 */
export function planFrontmatterAppend(
  existing: unknown,
  content: string,
): FrontmatterAppendPlan {
  if (!Array.isArray(existing)) {
    return { kind: "string-concat" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { kind: "array-push", values: [content] };
  }
  if (Array.isArray(parsed)) {
    return { kind: "array-push", values: parsed };
  }
  return { kind: "array-push", values: [parsed] };
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
 *   requested key. Array-typed values are handled structurally via the
 *   `planFrontmatterReplace` / `planFrontmatterAppend` helpers — `replace`
 *   on an array rejects scalar input rather than corrupting the structure
 *   (issue #12); `append` / `prepend` on an array push elements
 *   structurally, JSON-decoding the content when valid (issue #13).
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
  // Dispatches through the pure planners above so the policy stays testable
  // without needing the full `processFrontMatter` machinery. `rejection` is
  // captured out of the closure because `processFrontMatter` returns void —
  // we cannot bubble an Error back without aborting the write entirely (and
  // some Obsidian versions still rewrite the YAML even on throw, which would
  // produce a confusing partial-update). Setting a flag and skipping the
  // mutation keeps the file untouched while letting us return a typed error.
  if (args.targetType === "frontmatter") {
    let rejection: string | null = null;
    await app.fileManager.processFrontMatter(file, (fm) => {
      const existing = fm[args.target];
      if (args.operation === "replace") {
        const plan = planFrontmatterReplace(existing, args.content, args.target);
        if (plan.kind === "reject") {
          rejection = plan.message;
          return;
        }
        fm[args.target] = plan.kind === "ok" ? plan.value : args.content;
        return;
      }
      // append / prepend
      const plan = planFrontmatterAppend(existing, args.content);
      if (plan.kind === "array-push") {
        const arr = (existing as unknown[]).slice();
        if (args.operation === "append") arr.push(...plan.values);
        else arr.unshift(...plan.values);
        fm[args.target] = arr;
        return;
      }
      // string-concat: existing is scalar / null / undefined — keep the
      // legacy concatenation semantics for backward compatibility.
      if (existing == null) {
        fm[args.target] = args.content;
        return;
      }
      fm[args.target] =
        args.operation === "append"
          ? String(existing) + args.content
          : args.content + String(existing);
    });
    if (rejection !== null) {
      return {
        content: [{ type: "text", text: rejection }],
        isError: true,
      };
    }
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
    // For `replace`, the original section body absorbed the trailing blank
    // line that visually separated the heading we're patching from the next
    // sibling/parent heading. When we splice `body` in and concatenate the
    // tail starting at sectionEnd, that blank line disappears unless we
    // re-emit it — producing `## A\n<body>\n## B` instead of the expected
    // `## A\n<body>\n\n## B`. Only matters when the tail starts with another
    // heading and `body` does not already end with a newline.
    const tailIsHeading =
      sectionEnd < lines.length && /^#{1,6}\s/.test(lines[sectionEnd]);
    const bodyEndsBlank = body === "" || body.endsWith("\n");
    let newLines: string[];
    if (args.operation === "replace") {
      const separator = tailIsHeading && !bodyEndsBlank ? [""] : [];
      newLines = [
        ...lines.slice(0, headingLine + 1),
        body,
        ...separator,
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
}
