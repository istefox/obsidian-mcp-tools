import { makeBinaryRequest, makeRequest, type ToolRegistry } from "$/shared";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { type } from "arktype";
import { LocalRestAPI } from "shared";

export type PatchOperation = "append" | "prepend" | "replace";

export interface PatchHeadersInput {
  operation: PatchOperation;
  targetType: "heading" | "block" | "frontmatter";
  targetDelimiter?: string;
  trimTargetWhitespace?: boolean;
  contentType?: "text/markdown" | "application/json";
  createTargetIfMissing?: boolean;
}

/**
 * Build the HTTP headers for a PATCH request to the Local REST API. The
 * resolved `target` is URL-encoded so non-ASCII heading names (Cyrillic,
 * CJK, emoji) and reserved characters survive the HTTP header grammar —
 * the Local REST API decodes it server-side via decodeURIComponent.
 *
 * Encoding happens AFTER heading-path resolution so the indexer lookup
 * still compares against plain strings. See issues #78 and #30/#71.
 */
export function buildPatchHeaders(
  args: PatchHeadersInput,
  resolvedTarget: string,
): Record<string, string> {
  // Default behavior of Create-Target-If-Missing per target type:
  //   heading     → true  (upstream 0.2.x compatibility; most callers expect
  //                        a missing heading to be silently appended at EOF)
  //   frontmatter → true  (same upstream default; frontmatter keys rarely
  //                        produce silent-corruption footguns)
  //   block       → false (safer: when a block `^id` cannot be located —
  //                        especially when the id lives inside a markdown
  //                        table cell, where markdown-patch's block indexer
  //                        does not search — permissive silent EOF append
  //                        corrupts callers expecting atomic patch-or-fail.
  //                        Callers can explicitly opt back in with
  //                        createTargetIfMissing: true. Fixes upstream
  //                        issue #71's block-in-table gap.)
  const defaultCreateTargetIfMissing = args.targetType !== "block";
  const headers: Record<string, string> = {
    Operation: args.operation,
    "Target-Type": args.targetType,
    Target: encodeURIComponent(resolvedTarget),
    "Create-Target-If-Missing": String(
      args.createTargetIfMissing ?? defaultCreateTargetIfMissing,
    ),
  };

  if (args.targetDelimiter) {
    headers["Target-Delimiter"] = encodeURIComponent(args.targetDelimiter);
  }
  if (args.trimTargetWhitespace !== undefined) {
    headers["Trim-Target-Whitespace"] = String(args.trimTargetWhitespace);
  }
  if (args.contentType) {
    headers["Content-Type"] = args.contentType;
  }

  return headers;
}

/**
 * Ensure appended content ends with whitespace so the next section in the
 * document remains visually separated. markdown-patch does not insert any
 * separation on its own, so `**bold**` appended under a heading would
 * collide with the following `## Next Heading` line.
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
 * Detect a "root-orphan" heading match: a non-H1 heading at the root of the
 * file with no preceding H1 ancestor. The Local REST API's `markdown-patch`
 * indexer keys headings by their full hierarchical path starting from H1,
 * so a root-orphan H2/H3/… cannot be addressed by leaf name (or by any path
 * the wrapper can synthesize). Under the upstream-compat default
 * `Create-Target-If-Missing: true` for headings, the PATCH falls through to
 * the silent-create branch and appends the caller's content at EOF, leaving
 * the file with a duplicate heading and no in-place edit. Same family as
 * the silent EOF append behaviour fixed for `block` targets in #71 (0.3.7).
 *
 * Returns an actionable error message string when the call must be rejected,
 * or `null` when it is safe to proceed. Pure / synchronous so it can be unit
 * tested without network. Closes the heading half of upstream
 * `jacksteamdev/obsidian-mcp-tools#71`; reported by @folotp on the v0.3.7
 * follow-up.
 *
 * Walks the document in order; the first match of `leafName` decides the
 * outcome. If two headings share the same name and the earlier one is
 * orphan-root, the call is rejected — that ambiguity is itself a footgun
 * and a loud failure beats a coin-flip resolution.
 */
export function detectOrphanRootHeading(
  content: string,
  leafName: string,
): string | null {
  const lines = content.split("\n");
  let hasH1Before = false;
  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (!match) continue;
    const level = match[1].length;
    const headingText = match[2].trim();
    if (level === 1) hasH1Before = true;
    if (headingText === leafName) {
      if (level > 1 && !hasH1Before) {
        return (
          `Heading "${leafName}" is a level-${level} heading at the root ` +
          `of the file with no level-1 (\`#\`) parent. The Local REST API's ` +
          `markdown-patch indexer keys headings by their full hierarchical ` +
          `path starting from H1 and cannot resolve a root-orphan H${level}+ ` +
          `by leaf name; the PATCH would silently fall through to ` +
          `Create-Target-If-Missing and append the content at EOF, leaving ` +
          `a duplicate heading and no in-place edit. Workarounds: ` +
          `(1) add a level-1 heading at the top of the file before this ` +
          `section so the indexer has a key to anchor against; or ` +
          `(2) pass createTargetIfMissing=false on the call to make the ` +
          `failure explicit instead of a silent EOF append.`
        );
      }
      return null;
    }
  }
  return null;
}

/**
 * Parse markdown content and resolve a partial heading name to its full
 * hierarchical path as expected by the Local REST API `markdown-patch`
 * indexer (e.g. `"Section A"` → `"Top Level::Section A"`).
 *
 * Returns the full path of the first matching heading, or `null` if no
 * heading with that exact name exists in the content.
 *
 * Exported so it can be unit-tested without network access.
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
 * Mapping from lowercased file extension to canonical mime type for the
 * binary file categories this server knows about (audio, image, video,
 * documents, archives). Extensions absent from this map are treated as
 * non-binary and flow through the normal text/markdown read path.
 *
 * Markdown, JSON, YAML, HTML, CSV, TXT, and SVG are intentionally NOT
 * in this map — they are textual and should be readable via the usual
 * `get_vault_file` path.
 */
const BINARY_EXTENSION_MIME_TYPES: ReadonlyMap<string, string> = new Map([
  // Audio
  ["mp3", "audio/mpeg"],
  ["wav", "audio/wav"],
  ["m4a", "audio/mp4"],
  ["ogg", "audio/ogg"],
  ["opus", "audio/opus"],
  ["flac", "audio/flac"],
  ["aac", "audio/aac"],
  ["wma", "audio/x-ms-wma"],
  // Image
  ["png", "image/png"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["gif", "image/gif"],
  ["bmp", "image/bmp"],
  ["webp", "image/webp"],
  ["tiff", "image/tiff"],
  ["tif", "image/tiff"],
  ["ico", "image/x-icon"],
  ["avif", "image/avif"],
  ["heic", "image/heic"],
  ["heif", "image/heif"],
  // Video
  ["mp4", "video/mp4"],
  ["mov", "video/quicktime"],
  ["mkv", "video/x-matroska"],
  ["avi", "video/x-msvideo"],
  ["webm", "video/webm"],
  ["m4v", "video/x-m4v"],
  ["mpg", "video/mpeg"],
  ["mpeg", "video/mpeg"],
  ["wmv", "video/x-ms-wmv"],
  ["flv", "video/x-flv"],
  // Documents
  ["pdf", "application/pdf"],
  ["doc", "application/msword"],
  [
    "docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  ["xls", "application/vnd.ms-excel"],
  [
    "xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  ["ppt", "application/vnd.ms-powerpoint"],
  [
    "pptx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
  // Archives
  ["zip", "application/zip"],
  ["tar", "application/x-tar"],
  ["gz", "application/gzip"],
  ["7z", "application/x-7z-compressed"],
  ["rar", "application/vnd.rar"],
  ["bz2", "application/x-bzip2"],
]);

/**
 * Extract a lowercased file extension from a filename, or null if the
 * name has no extension. Hidden-file names like `.env` (leading dot,
 * no other dot) return null because the leading dot is not a separator.
 *
 * Exported for unit testing.
 */
export function extractFileExtension(name: string): string | null {
  const idx = name.lastIndexOf(".");
  // `idx <= 0` covers both "no dot at all" (-1) and "leading dot only"
  // (0), which handles hidden filenames like `.env` or `.gitignore`.
  if (idx <= 0 || idx === name.length - 1) return null;
  return name.slice(idx + 1).toLowerCase();
}

/**
 * Return true if the filename's extension identifies a known binary
 * file type that cannot be safely returned as markdown/text content
 * by `get_vault_file`.
 *
 * Exported for unit testing.
 */
export function isBinaryFilename(name: string): boolean {
  const ext = extractFileExtension(name);
  return ext !== null && BINARY_EXTENSION_MIME_TYPES.has(ext);
}

/**
 * Best-effort guess of a file's mime type based on its extension.
 * Falls back to `application/octet-stream` when the extension is
 * missing or unknown.
 *
 * Exported for unit testing. Intended to be called only in the
 * binary-file branch of `get_vault_file` — for textual files the
 * Local REST API response content-type is authoritative.
 */
export function guessMimeType(name: string): string {
  const ext = extractFileExtension(name);
  if (ext === null) return "application/octet-stream";
  return BINARY_EXTENSION_MIME_TYPES.get(ext) ?? "application/octet-stream";
}

/**
 * Upper bound on the raw byte size of a binary file we will inline in
 * the MCP tool result. Base64 encoding inflates the payload by ~33%, so
 * a 10 MiB cap translates to roughly 13.3 MiB of transport-layer text.
 * Files larger than this fall back to the text metadata response, which
 * directs the agent to open the file via `show_file_in_obsidian` rather
 * than burning the entire client context window on a single attachment.
 */
export const MAX_INLINE_BINARY_BYTES = 10 * 1024 * 1024;

/**
 * Classify a file's mime type into an MCP SDK 1.29.0 content-block kind
 * the server can return inline. Returns `"image"` or `"audio"` when the
 * mime type maps to a native content block, or `null` for formats the
 * SDK cannot carry (video, PDF, Office, archives) — those still use the
 * text metadata fallback.
 *
 * Only the top-level mime type is inspected. `image/*` and `audio/*`
 * both pass through regardless of the specific subtype; the MCP client
 * is expected to ignore or render-as-best-it-can any exotic variants.
 *
 * Exported for unit testing.
 */
export function classifyBinaryMime(
  mimeType: string | null | undefined,
): "image" | "audio" | null {
  if (!mimeType) return null;
  const topLevel = mimeType.split(";", 1)[0].trim().toLowerCase();
  if (topLevel.startsWith("image/")) return "image";
  if (topLevel.startsWith("audio/")) return "audio";
  return null;
}

/**
 * Build the MCP text metadata block that directs an agent to open a
 * non-inlinable binary file via `show_file_in_obsidian`. Used both for
 * formats the SDK can't carry natively (video, PDF, Office, archives)
 * and for audio/image files that exceed `MAX_INLINE_BINARY_BYTES`.
 *
 * Exported for unit testing.
 */
export function buildBinaryMetadataText(
  filename: string,
  mimeType: string,
  reason: "unsupported_type" | "too_large",
): string {
  const hintByReason: Record<typeof reason, string> = {
    unsupported_type:
      "This file is binary (video, PDF, Office document, or archive) and cannot be returned as text content. Use show_file_in_obsidian to open it in the Obsidian UI.",
    too_large:
      "This file is too large to be returned inline (exceeds the 10 MiB cap to avoid overflowing the MCP client context window). Use show_file_in_obsidian to open it in the Obsidian UI.",
  };
  return JSON.stringify(
    {
      kind: "binary_file",
      filename,
      mimeType,
      hint: hintByReason[reason],
    },
    null,
    2,
  );
}

/**
 * Encode raw bytes as a base64 string suitable for the `data` field of
 * an MCP `image` or `audio` content block. Uses `Buffer.from` under Bun
 * / Node — both runtimes this server ships under provide the global
 * `Buffer`, so this stays dependency-free.
 *
 * Exported for unit testing.
 */
export function encodeBytesAsBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

/**
 * Truncate simple-search results to the caller's requested maximum. The
 * Local REST API `/search/simple/` endpoint has no native `limit` query
 * parameter, so we slice client-side. Results are already ordered by
 * relevance score (highest first) by the server, making this equivalent
 * to a top-N cutoff. A `limit` of `undefined` returns the data unchanged.
 *
 * Exported so it can be unit-tested without network access. See issue #62.
 */
export function applySimpleSearchLimit<T>(
  data: readonly T[],
  limit: number | undefined,
): readonly T[] {
  return limit !== undefined ? data.slice(0, limit) : data;
}

export interface FrontmatterPatchPrecheckArgs {
  targetType: "heading" | "block" | "frontmatter";
  operation: PatchOperation;
  contentType?: "text/markdown" | "application/json";
}

/**
 * Same family as the block-target silent EOF append issue (#71): the wrapper
 * must not let a write reshape the targeted data without flagging the type
 * change.
 *
 * When a caller targets an array-valued frontmatter field with `replace` and
 * does NOT explicitly opt into JSON content (i.e. `contentType` is unset or
 * `text/markdown`), the Local REST API silently coerces the field from array
 * to scalar string. The PATCH returns 200 OK while the persisted file has
 * lost its array structure. Reject the request with an actionable 400
 * instead, so the caller has to either:
 *
 *   (a) restate intent as JSON (`contentType: "application/json"` and a
 *       JSON-encoded value — `'["new"]'` for a single-element array,
 *       `'null'` to clear), or
 *   (b) opt explicitly into the destructive coercion via `application/json`
 *       and a JSON scalar (which is at least an explicit signal, not a
 *       silent footgun).
 *
 * Returns the error message string when the call should be rejected, or
 * `null` when it is safe to proceed. Pure / synchronous so it can be unit
 * tested without network. Fixes folotp's #12.
 */
export function detectFrontmatterReplaceArrayMismatch(
  frontmatter: Record<string, unknown> | undefined | null,
  args: FrontmatterPatchPrecheckArgs,
  target: string,
): string | null {
  if (
    args.targetType !== "frontmatter" ||
    args.operation !== "replace" ||
    args.contentType === "application/json"
  ) {
    return null;
  }
  if (!frontmatter) return null;
  const value = frontmatter[target];
  if (!Array.isArray(value)) return null;
  return (
    `Refusing to replace array-valued frontmatter field "${target}" ` +
    `with text/markdown content: the Local REST API would silently ` +
    `coerce the field from array to scalar string and corrupt the ` +
    `existing structure. Pass contentType="application/json" and ` +
    `content as a JSON-encoded value — for example ` +
    `'["new"]' to set a single-element array, ` +
    `'["a","b"]' for multiple elements, or ` +
    `'null' to clear the field.`
  );
}

/**
 * Frontmatter `append`/`prepend` against an array-valued field requires the
 * Local REST API to receive the new element wrapped in a JSON array. When the
 * caller passes a JSON scalar (`'"new-tag"'` rather than `'["new-tag"]'`)
 * the upstream parser raises and the request returns HTTP 500 with no
 * actionable hint. The intent is unambiguous (append THIS element to the
 * array), so wrap the scalar in a single-element array client-side rather
 * than reject — DWIM where there is exactly one reasonable interpretation.
 *
 * Only triggers on `targetType === "frontmatter"` + `append`/`prepend` +
 * `contentType === "application/json"` to keep the surface area minimal:
 *
 *   - heading/block targets are unaffected (their content is markdown text,
 *     not JSON).
 *   - `replace` is unaffected (caller may legitimately want to replace an
 *     array with a scalar; that ambiguity is handled by
 *     `detectFrontmatterReplaceArrayMismatch` above, not by auto-wrapping).
 *   - non-JSON content types are unaffected.
 *
 * If the body is not parseable JSON we forward it untouched and let the REST
 * API surface its own error — silently rewriting a malformed payload would
 * just move the failure further down the stack.
 *
 * Pure / synchronous for unit testing. Fixes folotp's #13.
 */
export function coerceFrontmatterAppendArrayContent(
  content: string,
  args: FrontmatterPatchPrecheckArgs,
): string {
  if (
    args.targetType !== "frontmatter" ||
    (args.operation !== "append" && args.operation !== "prepend") ||
    args.contentType !== "application/json"
  ) {
    return content;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return content;
  }
  if (Array.isArray(parsed)) return content;
  return JSON.stringify([parsed]);
}

export function registerLocalRestApiTools(tools: ToolRegistry) {
  // GET Status
  tools.register(
    type({
      name: '"get_server_info"',
      // Empty object literal instead of "Record<string, unknown>" so that
      // ArkType emits a JSON schema with an explicit `properties: {}` key —
      // some non-Claude MCP clients (Letta Cloud, OpenAI-compatible) reject
      // schemas that omit `properties`, which Record<string, unknown> did.
      arguments: {},
    }).describe(
      "Returns basic details about the Obsidian Local REST API and authentication status. This is the only API request that does not require authentication.",
    ),
    async () => {
      const data = await makeRequest(LocalRestAPI.ApiStatusResponse, "/");
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  // GET Active File
  tools.register(
    type({
      name: '"get_active_file"',
      arguments: {
        format: type('"markdown" | "json"').optional(),
      },
    }).describe(
      "Returns the content of the currently active file in Obsidian. Can return either markdown content or a JSON representation including parsed tags and frontmatter.",
    ),
    async ({ arguments: args }) => {
      const format =
        args?.format === "json"
          ? "application/vnd.olrapi.note+json"
          : "text/markdown";
      const data = await makeRequest(
        LocalRestAPI.ApiNoteJson.or("string"),
        "/active/",
        {
          headers: { Accept: format },
        },
      );
      const content =
        typeof data === "string" ? data : JSON.stringify(data, null, 2);
      return { content: [{ type: "text", text: content }] };
    },
  );

  // PUT Active File
  tools.register(
    type({
      name: '"update_active_file"',
      arguments: {
        content: "string",
      },
    }).describe("Update the content of the active file open in Obsidian."),
    async ({ arguments: args }) => {
      await makeRequest(LocalRestAPI.ApiNoContentResponse, "/active/", {
        method: "PUT",
        body: args.content,
      });
      return {
        content: [{ type: "text", text: "File updated successfully" }],
      };
    },
  );

  // POST Active File
  tools.register(
    type({
      name: '"append_to_active_file"',
      arguments: {
        content: "string",
      },
    }).describe("Append content to the end of the currently-open note."),
    async ({ arguments: args }) => {
      await makeRequest(LocalRestAPI.ApiNoContentResponse, "/active/", {
        method: "POST",
        body: args.content,
      });
      return {
        content: [{ type: "text", text: "Content appended successfully" }],
      };
    },
  );

  // PATCH Active File
  tools.register(
    type({
      name: '"patch_active_file"',
      arguments: LocalRestAPI.ApiPatchParameters,
    }).describe(
      "Insert or modify content in the currently-open note relative to a heading, block reference, or frontmatter field.",
    ),
    async ({ arguments: args }) => {
      // Step 1: resolve partial heading names to full hierarchical paths.
      // Local REST API's markdown-patch indexer keys headings by their full
      // ancestor path (e.g. "Top Level::Section A"). When the caller supplies
      // just a leaf name ("Section A"), the lookup fails and — because
      // Create-Target-If-Missing is on by default — a new heading is silently
      // appended at EOF instead of patching the intended one. To prevent this,
      // fetch the file once, parse its heading tree, and expand the partial
      // name to a full path before issuing the PATCH.
      const targetDelimiter = args.targetDelimiter ?? "::";
      let resolvedTarget = args.target;

      if (
        args.targetType === "heading" &&
        !args.target.includes(targetDelimiter)
      ) {
        const fileContent = await makeRequest(
          LocalRestAPI.ApiContentResponse,
          "/active/",
          { headers: { Accept: "text/markdown" } },
        );
        // Reject root-orphan H2+ targets BEFORE handing off to the REST API:
        // markdown-patch keys headings under H1 and a leaf-only path for an
        // orphan H2/H3 hits the silent-create branch. Closes the heading
        // half of upstream #71. See detectOrphanRootHeading for the full
        // rationale and workarounds.
        const orphanError = detectOrphanRootHeading(fileContent, args.target);
        if (orphanError) {
          throw new McpError(ErrorCode.InvalidParams, orphanError);
        }
        const fullPath = resolveHeadingPath(
          fileContent,
          args.target,
          targetDelimiter,
        );
        if (fullPath) {
          resolvedTarget = fullPath;
        }
      }

      // Step 2 (issue #12): when a frontmatter `replace` lands on an
      // array-valued field without an explicit JSON content type, the
      // PATCH would silently destroy the array structure. Pre-fetch the
      // parsed frontmatter and reject with an actionable 400 instead.
      // Only one extra GET per frontmatter+replace+text-markdown call;
      // all other patch shapes skip the precheck.
      if (
        args.targetType === "frontmatter" &&
        args.operation === "replace" &&
        args.contentType !== "application/json"
      ) {
        let frontmatter: Record<string, unknown> | undefined;
        try {
          const note = await makeRequest(LocalRestAPI.ApiNoteJson, "/active/", {
            headers: { Accept: "application/vnd.olrapi.note+json" },
          });
          frontmatter = note.frontmatter;
        } catch {
          // Best-effort: if we cannot read the file (404, permission, etc.)
          // skip the precheck and let the actual PATCH propagate the error.
        }
        const errorMessage = detectFrontmatterReplaceArrayMismatch(
          frontmatter,
          args,
          args.target,
        );
        if (errorMessage) {
          throw new McpError(ErrorCode.InvalidParams, errorMessage);
        }
      }

      // Step 3 (issue #13): for frontmatter append/prepend with JSON
      // content, auto-wrap a JSON scalar payload in a single-element
      // array. The REST API returns 500 on scalar input — DWIM where
      // there is one reasonable interpretation. Skip normalizeAppendBody
      // in this branch so the trailing "\n\n" does not invalidate the
      // JSON body we just normalized.
      const isJsonFrontmatterAppendPrepend =
        args.targetType === "frontmatter" &&
        (args.operation === "append" || args.operation === "prepend") &&
        args.contentType === "application/json";

      const body = isJsonFrontmatterAppendPrepend
        ? coerceFrontmatterAppendArrayContent(args.content, args)
        : normalizeAppendBody(args.content, args.operation);
      const headers = buildPatchHeaders(args, resolvedTarget);

      const response = await makeRequest(
        LocalRestAPI.ApiContentResponse,
        "/active/",
        {
          method: "PATCH",
          headers,
          body,
        },
      );
      return {
        content: [
          { type: "text", text: "File patched successfully" },
          { type: "text", text: response },
        ],
      };
    },
  );

  // DELETE Active File
  tools.register(
    type({
      name: '"delete_active_file"',
      // Empty object literal instead of "Record<string, unknown>" so that
      // ArkType emits a JSON schema with an explicit `properties: {}` key —
      // some non-Claude MCP clients (Letta Cloud, OpenAI-compatible) reject
      // schemas that omit `properties`, which Record<string, unknown> did.
      arguments: {},
    }).describe("Delete the currently-active file in Obsidian."),
    async () => {
      await makeRequest(LocalRestAPI.ApiNoContentResponse, "/active/", {
        method: "DELETE",
      });
      return {
        content: [{ type: "text", text: "File deleted successfully" }],
      };
    },
  );

  // POST Open File in Obsidian UI
  tools.register(
    type({
      name: '"show_file_in_obsidian"',
      arguments: {
        filename: "string",
        "newLeaf?": "boolean",
      },
    }).describe(
      "Open a document in the Obsidian UI. Creates a new document if it doesn't exist. Returns a confirmation if the file was opened successfully.",
    ),
    async ({ arguments: args }) => {
      const query = args.newLeaf ? "?newLeaf=true" : "";

      await makeRequest(
        LocalRestAPI.ApiNoContentResponse,
        `/open/${encodeURIComponent(args.filename)}${query}`,
        {
          method: "POST",
        },
      );

      return {
        content: [{ type: "text", text: "File opened successfully" }],
      };
    },
  );

  // POST Search via Dataview or JsonLogic
  tools.register(
    type({
      name: '"search_vault"',
      arguments: {
        queryType: '"dataview" | "jsonlogic"',
        query: "string",
      },
    }).describe(
      "Search for documents matching a specified query using either Dataview DQL or JsonLogic.",
    ),
    async ({ arguments: args }) => {
      const contentType =
        args.queryType === "dataview"
          ? "application/vnd.olrapi.dataview.dql+txt"
          : "application/vnd.olrapi.jsonlogic+json";

      const data = await makeRequest(
        LocalRestAPI.ApiSearchResponse,
        "/search/",
        {
          method: "POST",
          headers: { "Content-Type": contentType },
          body: args.query,
        },
      );

      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  // POST Simple Search
  tools.register(
    type({
      name: '"search_vault_simple"',
      arguments: {
        query: "string",
        "contextLength?": type("number>0").describe(
          "Number of characters of surrounding context to include around each match.",
        ),
        "limit?": type("number>0").describe(
          "Maximum number of files to return. Results are ordered by relevance score (highest first), so this effectively returns the top-N matches. Omit to return all matches — useful on large vaults to keep the response within the model's context window.",
        ),
      },
    }).describe("Search for documents matching a text query."),
    async ({ arguments: args }) => {
      const query = new URLSearchParams({
        query: args.query,
        ...(args.contextLength
          ? {
              contextLength: String(args.contextLength),
            }
          : {}),
      });

      const data = await makeRequest(
        LocalRestAPI.ApiSimpleSearchResponse,
        `/search/simple/?${query}`,
        {
          method: "POST",
        },
      );

      const limited = applySimpleSearchLimit(data, args.limit);

      return {
        content: [{ type: "text", text: JSON.stringify(limited, null, 2) }],
      };
    },
  );

  // GET Vault Files or Directories List
  tools.register(
    type({
      name: '"list_vault_files"',
      arguments: {
        "directory?": "string",
      },
    }).describe(
      "List files in the root directory or a specified subdirectory of your vault.",
    ),
    async ({ arguments: args }) => {
      // Strip any trailing slashes the caller supplied so the final URL
      // never contains a double slash at the /vault/ boundary (e.g.
      // `/vault//Documents/`), which Local REST API v3.x returns as 500.
      const directory = args.directory?.replace(/\/+$/, "") || "";
      const pathSuffix = directory ? `${directory}/` : "";
      const data = await makeRequest(
        LocalRestAPI.ApiVaultFileResponse.or(
          LocalRestAPI.ApiVaultDirectoryResponse,
        ),
        `/vault/${pathSuffix}`,
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  // GET Vault File Content
  tools.register(
    type({
      name: '"get_vault_file"',
      arguments: {
        filename: "string",
        "format?": '"markdown" | "json"',
      },
    }).describe(
      "Get the content of a file from your vault. Text files (markdown, JSON, YAML, HTML, CSV, SVG, plain text) are returned directly. Audio and image files up to 10 MiB are returned inline as native MCP audio/image content blocks. Video, PDF, Office documents, archives, and oversize audio/image files return a structured metadata response directing you to open them via show_file_in_obsidian.",
    ),
    async ({ arguments: args }) => {
      // Binary file branch — extension-based detection, no HEAD request,
      // so markdown reads keep their fast path with zero extra roundtrips.
      if (isBinaryFilename(args.filename)) {
        const mimeType = guessMimeType(args.filename);
        const kind = classifyBinaryMime(mimeType);

        // Video / PDF / Office / archive: MCP SDK 1.29.0 has no native
        // content block that carries these, so we return the text
        // metadata hint (same behavior as the 0.3.0 short-circuit).
        if (kind === null) {
          return {
            content: [
              {
                type: "text",
                text: buildBinaryMetadataText(
                  args.filename,
                  mimeType,
                  "unsupported_type",
                ),
              },
            ],
          };
        }

        const { bytes, mimeType: responseMime } = await makeBinaryRequest(
          `/vault/${encodeURIComponent(args.filename)}`,
        );

        // Size-gate AFTER the fetch because Local REST API does not
        // reliably report Content-Length ahead of time. If the file is
        // larger than the inline cap, fall back to the text metadata
        // hint so we do not blow the client's context window.
        if (bytes.byteLength > MAX_INLINE_BINARY_BYTES) {
          return {
            content: [
              {
                type: "text",
                text: buildBinaryMetadataText(
                  args.filename,
                  mimeType,
                  "too_large",
                ),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: kind,
              data: encodeBytesAsBase64(bytes),
              // Prefer the server-reported Content-Type when the plugin
              // knows it — falls back to the extension-based guess if
              // the header is missing or malformed.
              mimeType: responseMime ?? mimeType,
            },
          ],
        };
      }

      const isJson = args.format === "json";
      const format = isJson
        ? "application/vnd.olrapi.note+json"
        : "text/markdown";
      const data = await makeRequest(
        isJson ? LocalRestAPI.ApiNoteJson : LocalRestAPI.ApiContentResponse,
        `/vault/${encodeURIComponent(args.filename)}`,
        {
          headers: { Accept: format },
        },
      );
      return {
        content: [
          {
            type: "text",
            text:
              typeof data === "string" ? data : JSON.stringify(data, null, 2),
          },
        ],
      };
    },
  );

  // PUT Vault File Content
  tools.register(
    type({
      name: '"create_vault_file"',
      arguments: {
        filename: "string",
        content: "string",
      },
    }).describe("Create a new file in your vault or update an existing one."),
    async ({ arguments: args }) => {
      await makeRequest(
        LocalRestAPI.ApiNoContentResponse,
        `/vault/${encodeURIComponent(args.filename)}`,
        {
          method: "PUT",
          body: args.content,
        },
      );
      return {
        content: [{ type: "text", text: "File created successfully" }],
      };
    },
  );

  // POST Vault File Content
  tools.register(
    type({
      name: '"append_to_vault_file"',
      arguments: {
        filename: "string",
        content: "string",
      },
    }).describe("Append content to a new or existing file."),
    async ({ arguments: args }) => {
      await makeRequest(
        LocalRestAPI.ApiNoContentResponse,
        `/vault/${encodeURIComponent(args.filename)}`,
        {
          method: "POST",
          body: args.content,
        },
      );
      return {
        content: [{ type: "text", text: "Content appended successfully" }],
      };
    },
  );

  // PATCH Vault File Content
  tools.register(
    type({
      name: '"patch_vault_file"',
      arguments: type({
        filename: "string",
      }).and(LocalRestAPI.ApiPatchParameters),
    }).describe(
      "Insert or modify content in a file relative to a heading, block reference, or frontmatter field.",
    ),
    async ({ arguments: args }) => {
      // See patch_active_file above for the full rationale of every step.
      // The only difference here is the endpoint from which we fetch file
      // content (heading resolution + frontmatter precheck) — the named
      // vault file instead of the currently active file.
      const targetDelimiter = args.targetDelimiter ?? "::";
      let resolvedTarget = args.target;
      const fileEndpoint = `/vault/${encodeURIComponent(args.filename)}`;

      if (
        args.targetType === "heading" &&
        !args.target.includes(targetDelimiter)
      ) {
        const fileContent = await makeRequest(
          LocalRestAPI.ApiContentResponse,
          fileEndpoint,
          { headers: { Accept: "text/markdown" } },
        );
        // See patch_active_file for the full rationale: reject root-orphan
        // H2+ targets before they hit the silent-create branch upstream.
        // Closes the heading half of upstream #71.
        const orphanError = detectOrphanRootHeading(fileContent, args.target);
        if (orphanError) {
          throw new McpError(ErrorCode.InvalidParams, orphanError);
        }
        const fullPath = resolveHeadingPath(
          fileContent,
          args.target,
          targetDelimiter,
        );
        if (fullPath) {
          resolvedTarget = fullPath;
        }
      }

      // Issue #12: reject silent array→scalar coercion on frontmatter
      // replace. See patch_active_file for the full rationale.
      if (
        args.targetType === "frontmatter" &&
        args.operation === "replace" &&
        args.contentType !== "application/json"
      ) {
        let frontmatter: Record<string, unknown> | undefined;
        try {
          const note = await makeRequest(
            LocalRestAPI.ApiNoteJson,
            fileEndpoint,
            { headers: { Accept: "application/vnd.olrapi.note+json" } },
          );
          frontmatter = note.frontmatter;
        } catch {
          // Best-effort: skip the precheck on read failure.
        }
        const errorMessage = detectFrontmatterReplaceArrayMismatch(
          frontmatter,
          args,
          args.target,
        );
        if (errorMessage) {
          throw new McpError(ErrorCode.InvalidParams, errorMessage);
        }
      }

      // Issue #13: auto-wrap scalar JSON payload for frontmatter
      // append/prepend. See patch_active_file for the full rationale.
      const isJsonFrontmatterAppendPrepend =
        args.targetType === "frontmatter" &&
        (args.operation === "append" || args.operation === "prepend") &&
        args.contentType === "application/json";

      const body = isJsonFrontmatterAppendPrepend
        ? coerceFrontmatterAppendArrayContent(args.content, args)
        : normalizeAppendBody(args.content, args.operation);
      const headers = buildPatchHeaders(args, resolvedTarget);

      const response = await makeRequest(
        LocalRestAPI.ApiContentResponse,
        fileEndpoint,
        {
          method: "PATCH",
          headers,
          body,
        },
      );

      return {
        content: [
          { type: "text", text: "File patched successfully" },
          { type: "text", text: response },
        ],
      };
    },
  );

  // DELETE Vault File Content
  tools.register(
    type({
      name: '"delete_vault_file"',
      arguments: {
        filename: "string",
      },
    }).describe("Delete a file from your vault."),
    async ({ arguments: args }) => {
      await makeRequest(
        LocalRestAPI.ApiNoContentResponse,
        `/vault/${encodeURIComponent(args.filename)}`,
        {
          method: "DELETE",
        },
      );
      return {
        content: [{ type: "text", text: "File deleted successfully" }],
      };
    },
  );
}
