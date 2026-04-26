/**
 * Heading-section chunker for vault markdown.
 *
 * Splits content on H1/H2 boundaries (H3+ stay inside their parent
 * section). Sections that exceed `maxTokens` (default 512) are split
 * further with a token-based sliding window using `overlapTokens`
 * (default 64). Sections shorter than `minTokens` (default 20) are
 * skipped — too little signal to embed usefully and too easy to
 * dominate cosine similarity with shared boilerplate.
 *
 * Frontmatter (`---` block at the very top of the file) is concatenated
 * to the first non-skipped chunk, so file-level metadata stays
 * searchable even when it lives outside the body prose.
 *
 * Inline tags (`#foo`), wikilinks (`[[link]]`), and code fences are
 * preserved verbatim — they are signal for embedding.
 *
 * Token counting is approximate: `text.split(/\s+/)`. The exact MiniLM
 * BPE tokenizer would be more precise but requires loading the model
 * just to size windows, which slows the chunker by an order of
 * magnitude. For the 512/64 window choices the approximation is well
 * within tolerance.
 */

export type ChunkOpts = {
  maxTokens?: number;
  overlapTokens?: number;
  minTokens?: number;
};

export type Chunk = {
  id: string;
  text: string;
  heading: string | null;
  offset: number;
  contentHash: string;
};

const DEFAULT_MAX_TOKENS = 512;
const DEFAULT_OVERLAP_TOKENS = 64;
const DEFAULT_MIN_TOKENS = 20;

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * Approximate token count via whitespace split. See file header for
 * the rationale on not loading the BPE tokenizer.
 */
export function countTokens(text: string): number {
  if (!text) return 0;
  return text.split(/\s+/).filter((s) => s.length > 0).length;
}

/**
 * SHA-256 hex digest, truncated to 16 chars. 64 bits is enough to
 * detect content edits with effectively zero false-positive rate at
 * vault sizes (collision probability ≈ N²/2^64; a 1M-chunk vault
 * has ~2.7e-8 probability of any collision, acceptable for a
 * cache-invalidation key).
 */
export async function hashChunk(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", encoded);
  const bytes = new Uint8Array(buf);
  let hex = "";
  for (let i = 0; i < 8; i++) {
    hex += bytes[i]!.toString(16).padStart(2, "0");
  }
  return hex;
}

type Section = { heading: string | null; text: string; offset: number };

/**
 * Extract frontmatter (if present) and return the remaining body plus
 * the offset adjustment for downstream consumers that want to map
 * chunks back to file positions.
 */
function extractFrontmatter(content: string): {
  frontmatter: string | null;
  body: string;
  bodyOffset: number;
} {
  const m = content.match(FRONTMATTER_RE);
  if (!m) return { frontmatter: null, body: content, bodyOffset: 0 };
  const fmText = m[1] ?? "";
  return {
    frontmatter: fmText,
    body: content.slice(m[0].length),
    bodyOffset: m[0].length,
  };
}

/**
 * Split body on H1 (`# `) and H2 (`## `) boundaries. H3+ stay inside
 * their parent section. The leading content before the first heading
 * is its own anonymous section (heading = null).
 */
function splitByHeadings(body: string, baseOffset: number): Section[] {
  const lines = body.split(/(\r?\n)/); // keep separators to preserve offsets
  const sections: Section[] = [];
  let current: Section = { heading: null, text: "", offset: baseOffset };
  let cursor = baseOffset;

  for (let i = 0; i < lines.length; i += 2) {
    const line = lines[i] ?? "";
    const sep = lines[i + 1] ?? "";

    const h1 = /^(# )(.+)$/.exec(line);
    const h2 = /^(## )(.+)$/.exec(line);
    const heading = h1?.[2] ?? h2?.[2] ?? null;

    if (heading !== null) {
      // Close current section and open a new one.
      if (current.text.length > 0) sections.push(current);
      current = {
        heading,
        text: line + sep,
        offset: cursor,
      };
    } else {
      current.text += line + sep;
    }
    cursor += line.length + sep.length;
  }

  if (current.text.length > 0) sections.push(current);
  return sections;
}

/**
 * Sliding-window split for sections that exceed `maxTokens`. Each
 * window has at most `maxTokens` whitespace-delimited tokens; adjacent
 * windows share `overlapTokens` tokens. The first heading line of the
 * section is repeated at the head of every window so each chunk
 * carries its context.
 */
function slidingWindows(
  text: string,
  heading: string | null,
  maxTokens: number,
  overlapTokens: number,
): string[] {
  // Preserve the heading line on every window.
  let prefix = "";
  let body = text;
  if (heading !== null) {
    const firstNewline = text.indexOf("\n");
    if (firstNewline !== -1) {
      prefix = text.slice(0, firstNewline + 1);
      body = text.slice(firstNewline + 1);
    }
  }

  const tokens = body.split(/(\s+)/); // keep whitespace tokens to recover spacing
  // Compress to alternating word/whitespace runs and index only the
  // word tokens so the window step is in real tokens.
  const wordIndices: number[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] && /\S/.test(tokens[i] ?? "")) wordIndices.push(i);
  }

  if (wordIndices.length <= maxTokens) return [prefix + body];

  const windows: string[] = [];
  const step = Math.max(1, maxTokens - overlapTokens);
  for (let start = 0; start < wordIndices.length; start += step) {
    const end = Math.min(start + maxTokens, wordIndices.length);
    const fromIdx = wordIndices[start];
    if (fromIdx === undefined) break;
    const toIdx =
      end >= wordIndices.length
        ? tokens.length
        : (wordIndices[end] ?? tokens.length);
    const slice = tokens.slice(fromIdx, toIdx).join("");
    windows.push(prefix + slice);
    if (end >= wordIndices.length) break;
  }
  return windows;
}

/**
 * Main chunker. Accepts the full markdown content of a file and
 * returns the chunks ready for embedding. Pure function: no I/O, no
 * Obsidian API access, no globals. The caller (T9 indexer) supplies
 * the file path and composes the persistent chunkId.
 */
export async function chunk(
  content: string,
  opts: ChunkOpts = {},
): Promise<Chunk[]> {
  const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
  const overlapTokens = opts.overlapTokens ?? DEFAULT_OVERLAP_TOKENS;
  const minTokens = opts.minTokens ?? DEFAULT_MIN_TOKENS;

  const { frontmatter, body, bodyOffset } = extractFrontmatter(content);
  const sections = splitByHeadings(body, bodyOffset);

  const chunks: Chunk[] = [];
  let mergedFrontmatter = frontmatter !== null;

  for (const section of sections) {
    let text = section.text.trimEnd();
    if (mergedFrontmatter && frontmatter !== null) {
      text = frontmatter.trim() + "\n\n" + text;
      mergedFrontmatter = false;
    }
    const tokenCount = countTokens(text);
    if (tokenCount < minTokens) continue;

    if (tokenCount <= maxTokens) {
      chunks.push({
        id: String(chunks.length),
        text,
        heading: section.heading,
        offset: section.offset,
        contentHash: await hashChunk(text),
      });
    } else {
      const windows = slidingWindows(
        text,
        section.heading,
        maxTokens,
        overlapTokens,
      );
      for (const w of windows) {
        chunks.push({
          id: String(chunks.length),
          text: w,
          heading: section.heading,
          offset: section.offset,
          contentHash: await hashChunk(w),
        });
      }
    }
  }

  // If frontmatter never landed (every section was below minTokens),
  // emit it as a standalone chunk if the frontmatter itself meets the
  // size threshold. Otherwise the file is effectively skipped.
  if (mergedFrontmatter && frontmatter !== null) {
    const fmText = frontmatter.trim();
    if (countTokens(fmText) >= minTokens) {
      chunks.push({
        id: String(chunks.length),
        text: fmText,
        heading: null,
        offset: 0,
        contentHash: await hashChunk(fmText),
      });
    }
  }

  return chunks;
}
