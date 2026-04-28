import { describe, expect, test } from "bun:test";
import {
  buildPatchHeaders,
  normalizeAppendBody,
  resolveHeadingPath,
} from "./index";

describe("resolveHeadingPath", () => {
  test("returns null for empty content", () => {
    expect(resolveHeadingPath("", "Anything", "::")).toBeNull();
  });

  test("returns null for content without any headings", () => {
    const content = "Just some paragraph text.\nNo headings here at all.";
    expect(resolveHeadingPath(content, "Section", "::")).toBeNull();
  });

  test("returns the H1 name when a top-level heading matches", () => {
    const content = `# Top Level\n\nSome body.`;
    expect(resolveHeadingPath(content, "Top Level", "::")).toBe("Top Level");
  });

  test("resolves a partial H2 leaf name to its full hierarchical path", () => {
    const content = `# Top Level\n\n## Section A\n\nBody.`;
    expect(resolveHeadingPath(content, "Section A", "::")).toBe(
      "Top Level::Section A",
    );
  });

  test("resolves deep nesting across H1/H2/H3", () => {
    const content = `
# Top
## Middle
### Deep
Some body.
    `;
    expect(resolveHeadingPath(content, "Deep", "::")).toBe(
      "Top::Middle::Deep",
    );
  });

  test("returns null when the leaf name does not exist", () => {
    const content = `# Top\n## Section A`;
    expect(resolveHeadingPath(content, "Section B", "::")).toBeNull();
  });

  test("returns the first match when multiple headings share the same name", () => {
    const content = `
# Alpha
## Notes
# Beta
## Notes
    `;
    // The first "Notes" is nested under Alpha; that's what we return.
    expect(resolveHeadingPath(content, "Notes", "::")).toBe("Alpha::Notes");
  });

  test("respects a custom delimiter passed by the caller", () => {
    const content = `# Top\n## Leaf`;
    expect(resolveHeadingPath(content, "Leaf", " > ")).toBe("Top > Leaf");
  });

  test("resets deeper stack slots when returning to a shallower level", () => {
    // After leaving "## Old Section" behind, a subsequent top-level "# New"
    // must not still expose "Old Section" as an ancestor of its children.
    const content = `
# First
## Old Section
# New
## Target
    `;
    expect(resolveHeadingPath(content, "Target", "::")).toBe("New::Target");
  });

  test("ignores paragraph text that resembles a heading mid-line", () => {
    // Only lines that actually start with '#' count as headings. A line like
    // "some text # not a heading" must be skipped by the parser.
    const content = `
Plain paragraph # not a heading
# Real Heading
    `;
    expect(resolveHeadingPath(content, "Real Heading", "::")).toBe(
      "Real Heading",
    );
  });
});

describe("buildPatchHeaders — issue #78 (non-ASCII) + wiring", () => {
  test("URL-encodes Cyrillic heading names so the HTTP layer accepts them", () => {
    // Go's net/http and Node's fetch both reject non-ASCII bytes in header
    // values. Encoding is the agreed contract with Local REST API, which
    // calls decodeURIComponent on the Target header server-side.
    const headers = buildPatchHeaders(
      { operation: "replace", targetType: "heading" },
      "Детали",
    );
    expect(headers.Target).toBe(
      "%D0%94%D0%B5%D1%82%D0%B0%D0%BB%D0%B8",
    );
  });

  test("URL-encodes CJK characters", () => {
    const headers = buildPatchHeaders(
      { operation: "append", targetType: "heading" },
      "詳細",
    );
    expect(headers.Target).toBe("%E8%A9%B3%E7%B4%B0");
  });

  test("URL-encodes characters forbidden in header values (newlines, accents)", () => {
    const headers = buildPatchHeaders(
      { operation: "replace", targetType: "heading" },
      "Généré avec [[Claude.ai]]",
    );
    // Spaces become %20 (encodeURIComponent, not form-urlencoded's '+').
    expect(headers.Target).toBe(
      "G%C3%A9n%C3%A9r%C3%A9%20avec%20%5B%5BClaude.ai%5D%5D",
    );
  });

  test("leaves plain ASCII unchanged", () => {
    const headers = buildPatchHeaders(
      { operation: "replace", targetType: "heading" },
      "Top Level::Section A",
    );
    // encodeURIComponent encodes ':' as %3A — this is intentional; the
    // Local REST API's decodeURIComponent restores it before the indexer
    // lookup, so the full-path delimiter still matches.
    expect(headers.Target).toBe("Top%20Level%3A%3ASection%20A");
  });

  test("stringifies createTargetIfMissing: true for explicit opt-in on heading", () => {
    // Explicit opt-in for the permissive create-on-missing path — the
    // header reflects the caller's choice verbatim. The opt-in path is
    // typically a migration script that creates section markers on first
    // run; rare in agent-caller traffic. Per-target-type defaults are
    // pinned in the issue #71 + #58 block below.
    const headers = buildPatchHeaders(
      {
        operation: "append",
        targetType: "heading",
        createTargetIfMissing: true,
      },
      "X",
    );
    expect(headers["Create-Target-If-Missing"]).toBe("true");
  });

  test("stringifies createTargetIfMissing: false for explicit strict mode", () => {
    const headers = buildPatchHeaders(
      {
        operation: "replace",
        targetType: "heading",
        createTargetIfMissing: false,
      },
      "X",
    );
    expect(headers["Create-Target-If-Missing"]).toBe("false");
  });

  test("URL-encodes Target-Delimiter when provided", () => {
    // Target-Delimiter flows through the same HTTP-header hazard as
    // Target, so we encode it symmetrically.
    const headers = buildPatchHeaders(
      {
        operation: "replace",
        targetType: "heading",
        targetDelimiter: " ➜ ",
      },
      "X",
    );
    expect(headers["Target-Delimiter"]).toBe("%20%E2%9E%9C%20");
  });

  test("omits Target-Delimiter header when not provided", () => {
    const headers = buildPatchHeaders(
      { operation: "replace", targetType: "heading" },
      "X",
    );
    expect(headers["Target-Delimiter"]).toBeUndefined();
  });

  test("passes through Trim-Target-Whitespace only when explicitly set", () => {
    const onFalse = buildPatchHeaders(
      {
        operation: "replace",
        targetType: "heading",
        trimTargetWhitespace: false,
      },
      "X",
    );
    expect(onFalse["Trim-Target-Whitespace"]).toBe("false");

    const unset = buildPatchHeaders(
      { operation: "replace", targetType: "heading" },
      "X",
    );
    expect(unset["Trim-Target-Whitespace"]).toBeUndefined();
  });

  test("forwards Content-Type only when provided", () => {
    const withCt = buildPatchHeaders(
      {
        operation: "replace",
        targetType: "frontmatter",
        contentType: "application/json",
      },
      "alpha",
    );
    expect(withCt["Content-Type"]).toBe("application/json");

    const withoutCt = buildPatchHeaders(
      { operation: "replace", targetType: "frontmatter" },
      "alpha",
    );
    expect(withoutCt["Content-Type"]).toBeUndefined();
  });

  test("always emits Operation and Target-Type verbatim", () => {
    const headers = buildPatchHeaders(
      { operation: "prepend", targetType: "block" },
      "ref-id",
    );
    expect(headers.Operation).toBe("prepend");
    expect(headers["Target-Type"]).toBe("block");
  });
});

describe("buildPatchHeaders — issues #71 + #58 (per-target-type Create-Target-If-Missing defaults)", () => {
  test("heading target defaults Create-Target-If-Missing to 'false' (issue #58, 0.4.0)", () => {
    // Rationale: an unresolvable heading target (typo on the leaf, missing
    // parent H1, stale reference) used to fall through to silent EOF append.
    // In the dominant agent-caller use case the HTTP 200 is indistinguishable
    // from a successful in-place patch without a post-write read, so silent-
    // create is data corruption. The flip mirrors the v0.3.7 (#6) `block`
    // flip rationale: fail loud, agent caller can react, callers who
    // genuinely want the permissive path opt in explicitly.
    const headers = buildPatchHeaders(
      { operation: "append", targetType: "heading" },
      "Section A",
    );
    expect(headers["Create-Target-If-Missing"]).toBe("false");
  });

  test("block target defaults Create-Target-If-Missing to 'false' (issue #71, v0.3.7)", () => {
    // Rationale: a block `^id` that cannot be located — especially one
    // inside a markdown table cell, which markdown-patch's block indexer
    // does not search — must fail loud instead of silently appending the
    // caller's content at EOF. Silent EOF append on a missing block is
    // data corruption: the caller gets HTTP 200 but the vault is now in
    // an unexpected shape, with the "patch" accumulated at file end rather
    // than in place. Unchanged from v0.3.7.
    const headers = buildPatchHeaders(
      { operation: "replace", targetType: "block" },
      "block-id-42",
    );
    expect(headers["Create-Target-If-Missing"]).toBe("false");
  });

  test("frontmatter target default remains 'true' (no regression)", () => {
    // Frontmatter keys rarely produce silent-corruption footguns: missing
    // keys can be legitimately created (that's the point for a lot of
    // Templater-backed flows), and the shape of a frontmatter value is
    // well-defined. Keep permissive default.
    const headers = buildPatchHeaders(
      { operation: "replace", targetType: "frontmatter" },
      "aliases",
    );
    expect(headers["Create-Target-If-Missing"]).toBe("true");
  });

  test("heading target with createTargetIfMissing: true explicitly overrides the safe default", () => {
    // Opt-in for callers who genuinely want the permissive behaviour on
    // headings (rare — typically a migration script that creates section
    // markers on first run). Explicit is better than implicit. The
    // wrapper-side `detectOrphanRootHeading` from v0.3.9 (#16) still fires
    // on the orphan-root H2+ shape regardless of this flag, as defence-
    // in-depth.
    const headers = buildPatchHeaders(
      {
        operation: "append",
        targetType: "heading",
        createTargetIfMissing: true,
      },
      "Section A",
    );
    expect(headers["Create-Target-If-Missing"]).toBe("true");
  });

  test("heading target with createTargetIfMissing: false explicitly is idempotent with the new default", () => {
    // Idempotence: explicit `false` on a heading target is the same as the
    // 0.4.0 default. No surprise; pinning the path so a future refactor
    // can't drift the explicit-opt-in semantics.
    const headers = buildPatchHeaders(
      {
        operation: "replace",
        targetType: "heading",
        createTargetIfMissing: false,
      },
      "Section A",
    );
    expect(headers["Create-Target-If-Missing"]).toBe("false");
  });

  test("block target with createTargetIfMissing: true explicitly overrides the safe default", () => {
    // Opt-in for callers who genuinely want the permissive behavior on
    // blocks (e.g. a migration script that appends a marker block if it
    // doesn't exist yet). Explicit is better than implicit.
    const headers = buildPatchHeaders(
      {
        operation: "append",
        targetType: "block",
        createTargetIfMissing: true,
      },
      "marker-block",
    );
    expect(headers["Create-Target-If-Missing"]).toBe("true");
  });

  test("block target with createTargetIfMissing: false explicitly is still 'false'", () => {
    // Idempotence: explicit `false` on a block target is the same as the
    // new default. No surprise.
    const headers = buildPatchHeaders(
      {
        operation: "replace",
        targetType: "block",
        createTargetIfMissing: false,
      },
      "block-id",
    );
    expect(headers["Create-Target-If-Missing"]).toBe("false");
  });
});

describe("normalizeAppendBody — trailing newline safeguard", () => {
  test("appends two newlines to an append-body without a trailing newline", () => {
    // Without this, markdown like `**done**` appended under a heading
    // collides with the next heading line: `**done**## Next`.
    expect(normalizeAppendBody("new line", "append")).toBe("new line\n\n");
  });

  test("leaves an append-body that already ends with a newline alone", () => {
    // Callers who already terminated their payload with '\n' or '\n\n'
    // should not get extra whitespace tacked on.
    expect(normalizeAppendBody("line\n", "append")).toBe("line\n");
    expect(normalizeAppendBody("line\n\n", "append")).toBe("line\n\n");
  });

  test("does not mutate replace bodies", () => {
    // Replace swaps a region in-place; adding whitespace would leak into
    // the document content.
    expect(normalizeAppendBody("replacement", "replace")).toBe("replacement");
  });

  test("does not mutate prepend bodies", () => {
    // Prepend inserts before the target; trailing whitespace would push
    // the existing content one blank line down, which isn't desired.
    expect(normalizeAppendBody("new intro", "prepend")).toBe("new intro");
  });

  test("handles an empty append body", () => {
    // Defensive: an empty append body is odd but not illegal. The helper
    // must not crash, and the `\n\n` is preserved semantics (a zero-length
    // payload followed by separation) rather than a special case.
    expect(normalizeAppendBody("", "append")).toBe("\n\n");
  });
});
