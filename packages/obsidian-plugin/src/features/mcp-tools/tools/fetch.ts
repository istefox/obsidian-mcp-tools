import { type } from "arktype";
import { requestUrl } from "obsidian";
import TurndownService from "turndown";

const DEFAULT_MAX_LENGTH = 5000;

/**
 * Schema for the fetch MCP tool.
 *
 * Fetches a URL and returns the body as Markdown (default, via Turndown)
 * or raw HTML, with pagination support for long pages.
 */
export const fetchSchema = type({
  name: '"fetch"',
  arguments: {
    // ArkType `string.url` uses the `isParsableUrl` predicate, which is not
    // convertible to JSON Schema and would crash `tools/list`. URL validity
    // is enforced at runtime by Obsidian's `requestUrl` (see handler).
    url: type("string").describe("URL to fetch."),
    "format?": type('"markdown"|"html"').describe(
      "Response format. Default markdown (HTML→MD via Turndown).",
    ),
    "maxLength?": type("number.integer>=1").describe(
      "Maximum characters to return. Default 5000.",
    ),
    "startIndex?": type("number.integer>=0").describe(
      "Starting character offset. Default 0.",
    ),
  },
}).describe(
  "Fetches a URL and returns the body as Markdown (default) or raw HTML, with pagination support for long pages.",
);

/**
 * Context object passed to the fetchHandler function.
 */
export type FetchContext = {
  arguments: {
    url: string;
    format?: "markdown" | "html";
    maxLength?: number;
    startIndex?: number;
  };
};

/**
 * Handles the fetch MCP tool request.
 *
 * Fetches the given URL using Obsidian's requestUrl API, converts HTML to
 * Markdown using Turndown (unless format="html"), and applies pagination
 * logic (startIndex and maxLength).
 *
 * Returns:
 *   - MCP-formatted response with one text content block
 *   - If content exceeds maxLength, includes a truncation hint with instructions
 *     for fetching the next chunk via startIndex
 *
 * Args:
 *   ctx: Context containing url, format, maxLength, startIndex
 *
 * Returns:
 *   MCP tool result with content array
 */
export async function fetchHandler(
  ctx: FetchContext,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  const format = ctx.arguments.format ?? "markdown";
  const maxLength = ctx.arguments.maxLength ?? DEFAULT_MAX_LENGTH;
  const startIndex = ctx.arguments.startIndex ?? 0;

  let response;
  try {
    response = await requestUrl({ url: ctx.arguments.url });
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: `Fetch failed: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      isError: true,
    };
  }

  let body = response.text;

  // Convert HTML to Markdown if format is "markdown"
  if (format === "markdown") {
    const td = new TurndownService({
      headingStyle: "atx",
      hr: "---",
      bulletListMarker: "-",
      codeBlockStyle: "fenced",
    });
    body = td.turndown(body);
  }

  // Apply pagination: slice from startIndex to startIndex + maxLength
  const sliced = body.slice(startIndex, startIndex + maxLength);
  const totalLength = body.length;
  const isTruncated = totalLength > startIndex + maxLength;

  // Add truncation hint if content was truncated
  const truncationNote = isTruncated
    ? `\n\n[Content truncated. ${totalLength - startIndex - maxLength} characters remaining; resume with startIndex=${startIndex + maxLength}.]`
    : "";

  return {
    content: [{ type: "text", text: sliced + truncationNote }],
  };
}
