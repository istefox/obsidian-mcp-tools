import { describe, expect, test } from "bun:test";
import {
  hasParentH1,
  isInsideTableOrFencedCode,
  resolveHeadingPath,
  normalizeAppendBody,
  findBlockReferenceInContent,
  findBlockPositionFromCache,
  planFrontmatterReplace,
  planFrontmatterAppend,
} from "./patchHelpers";

describe("resolveHeadingPath", () => {
  test("matches single-level heading", () => {
    const content = "# Top\n\nbody\n\n## Section A\n";
    expect(resolveHeadingPath(content, "Section A", "::")).toBe("Top::Section A");
  });

  test("matches nested heading via stack", () => {
    const content = "# A\n\n## B\n\n### C\n\nbody\n\n## D\n";
    expect(resolveHeadingPath(content, "C", "::")).toBe("A::B::C");
  });

  test("returns null on miss", () => {
    const content = "# A\n\n## B\n";
    expect(resolveHeadingPath(content, "X", "::")).toBeNull();
  });

  test("respects custom delimiter", () => {
    const content = "# A\n\n## B\n";
    expect(resolveHeadingPath(content, "B", " > ")).toBe("A > B");
  });

  test("returns first match when multiple headings have same leaf name", () => {
    const content = "# A\n\n## X\n\n# B\n\n## X\n";
    expect(resolveHeadingPath(content, "X", "::")).toBe("A::X");
  });
});

describe("normalizeAppendBody", () => {
  test("appends double newline on append op when missing", () => {
    expect(normalizeAppendBody("text", "append")).toBe("text\n\n");
  });

  test("leaves content unchanged when already ends with newline", () => {
    expect(normalizeAppendBody("text\n", "append")).toBe("text\n");
  });

  test("leaves replace ops untouched", () => {
    expect(normalizeAppendBody("text", "replace")).toBe("text");
  });

  test("leaves prepend ops untouched", () => {
    expect(normalizeAppendBody("text", "prepend")).toBe("text");
  });
});

describe("findBlockReferenceInContent", () => {
  test("returns position for known block id", () => {
    const content = "Para 1\n\nPara 2\n^abc123\n\nPara 3\n";
    const pos = findBlockReferenceInContent(content, "abc123");
    expect(pos).not.toBeNull();
    expect(pos?.startLine).toBeGreaterThanOrEqual(0);
  });

  test("returns null for unknown block id", () => {
    const content = "Para 1\n\nPara 2\n";
    expect(findBlockReferenceInContent(content, "nonexistent")).toBeNull();
  });
});

describe("findBlockPositionFromCache", () => {
  test("returns position for cached block id", () => {
    const cache = {
      blocks: {
        myblock: { position: { start: { line: 5 }, end: { line: 7 } } },
      },
    };
    const pos = findBlockPositionFromCache(cache, "myblock");
    expect(pos).toEqual({ startLine: 5, endLine: 7 });
  });

  test("returns null when block not in cache", () => {
    const cache = { blocks: {} };
    expect(findBlockPositionFromCache(cache, "missing")).toBeNull();
  });

  test("returns null when cache has no blocks property", () => {
    const cache = {};
    expect(findBlockPositionFromCache(cache as { blocks?: Record<string, unknown> }, "x")).toBeNull();
  });
});

// ─── Frontmatter planners (issues #12, #13) ────────────────────────────────

describe("planFrontmatterReplace", () => {
  test("scalar existing → ok-string (legacy assign-as-string)", () => {
    expect(planFrontmatterReplace("draft", "published", "status")).toEqual({
      kind: "ok-string",
    });
  });

  test("missing existing → ok-string", () => {
    expect(planFrontmatterReplace(undefined, "x", "any")).toEqual({
      kind: "ok-string",
    });
    expect(planFrontmatterReplace(null, "x", "any")).toEqual({
      kind: "ok-string",
    });
  });

  test("array existing + JSON array content → ok with parsed array", () => {
    expect(planFrontmatterReplace(["a", "b"], '["c","d"]', "tags")).toEqual({
      kind: "ok",
      value: ["c", "d"],
    });
  });

  test("array existing + JSON null → ok with value=null (clears the field)", () => {
    expect(planFrontmatterReplace(["a"], "null", "tags")).toEqual({
      kind: "ok",
      value: null,
    });
  });

  test("issue #12: array existing + plain string content → reject", () => {
    const result = planFrontmatterReplace(["alpha", "beta"], "gamma", "tags");
    expect(result.kind).toBe("reject");
    if (result.kind === "reject") {
      expect(result.message).toContain("tags");
      expect(result.message).toMatch(/array/i);
      expect(result.message).toMatch(/JSON/i);
    }
  });

  test("array existing + JSON scalar content → reject (would still flatten)", () => {
    const result = planFrontmatterReplace(["a"], '"single"', "tags");
    expect(result.kind).toBe("reject");
  });

  test("array existing + JSON object content → reject", () => {
    const result = planFrontmatterReplace(["a"], '{"k":"v"}', "tags");
    expect(result.kind).toBe("reject");
  });

  test("array existing + empty content → reject (empty is not valid JSON)", () => {
    const result = planFrontmatterReplace(["a"], "", "tags");
    expect(result.kind).toBe("reject");
  });

  test("nested array assignment is preserved", () => {
    expect(
      planFrontmatterReplace(["a"], '[["nested"],["array"]]', "matrix"),
    ).toEqual({
      kind: "ok",
      value: [["nested"], ["array"]],
    });
  });
});

describe("planFrontmatterAppend", () => {
  test("scalar existing → string-concat (legacy)", () => {
    expect(planFrontmatterAppend("draft", " v2")).toEqual({
      kind: "string-concat",
    });
  });

  test("missing existing → string-concat", () => {
    expect(planFrontmatterAppend(undefined, "x")).toEqual({
      kind: "string-concat",
    });
    expect(planFrontmatterAppend(null, "x")).toEqual({
      kind: "string-concat",
    });
  });

  test("array existing + plain string content → push as single string element", () => {
    // The DWIM branch: an LLM caller that doesn't know about JSON encoding
    // sends the bare tag, and it lands as an array element.
    expect(planFrontmatterAppend(["existing"], "new-tag")).toEqual({
      kind: "array-push",
      values: ["new-tag"],
    });
  });

  test("issue #13: array existing + JSON scalar content → push parsed scalar", () => {
    // Was the original failure: 0.3.x returned 500, 0.4.0 corrupted via
    // String(["existing"]) + content. The plan splits the scalar onto its
    // own array element.
    expect(planFrontmatterAppend(["existing"], '"new-tag"')).toEqual({
      kind: "array-push",
      values: ["new-tag"],
    });
  });

  test("array existing + JSON array content → spread parsed array elements", () => {
    expect(planFrontmatterAppend(["a"], '["b","c"]')).toEqual({
      kind: "array-push",
      values: ["b", "c"],
    });
  });

  test("array existing + JSON number → push parsed number", () => {
    expect(planFrontmatterAppend([1, 2], "3")).toEqual({
      kind: "array-push",
      values: [3],
    });
  });

  test("array existing + JSON null → push null as element", () => {
    expect(planFrontmatterAppend(["a"], "null")).toEqual({
      kind: "array-push",
      values: [null],
    });
  });

  test("array existing + malformed JSON → push raw content as string element", () => {
    expect(planFrontmatterAppend(["a"], "[unclosed")).toEqual({
      kind: "array-push",
      values: ["[unclosed"],
    });
  });
});

describe("hasParentH1", () => {
  test("returns true when an H1 line precedes the heading line", () => {
    const lines = ["# Top", "", "## Section", ""];
    expect(hasParentH1(lines, 2)).toBe(true);
  });

  test("returns false when no H1 precedes (root-orphan H2)", () => {
    const lines = ["## RootHeading", "", "Body."];
    expect(hasParentH1(lines, 0)).toBe(false);
  });

  test("returns false when only deeper headings precede", () => {
    const lines = ["## Sub1", "", "### Deeper", "", "## Sub2"];
    expect(hasParentH1(lines, 4)).toBe(false);
  });

  test("returns true for H3 with H1 grandparent (no H2 parent required)", () => {
    const lines = ["# Top", "", "### DeepRoot"];
    expect(hasParentH1(lines, 2)).toBe(true);
  });

  test("returns false at headingLine=0 (first line is the target)", () => {
    const lines = ["## RootHeading", "Body."];
    expect(hasParentH1(lines, 0)).toBe(false);
  });

  test("ignores `#` characters that are not at column 0 of a heading line", () => {
    const lines = ["Some prose with # not-a-heading", "## Real"];
    expect(hasParentH1(lines, 1)).toBe(false);
  });
});

describe("isInsideTableOrFencedCode", () => {
  test("detects line inside a 3-row markdown table (data-row position)", () => {
    const lines = [
      "## Section",
      "",
      "| Col | Data |",
      "| --- | --- |",
      "| a   | b ^cell-id |",
      "",
      "End.",
    ];
    expect(isInsideTableOrFencedCode(lines, 4)).toBe(true);
  });

  test("detects line at header-row position above separator", () => {
    const lines = [
      "| Col | Data |",
      "| --- | --- |",
      "| row | val  |",
    ];
    expect(isInsideTableOrFencedCode(lines, 0)).toBe(true);
  });

  test("detects separator row itself", () => {
    const lines = [
      "| Col | Data |",
      "| --- | --- |",
      "| row | val  |",
    ];
    expect(isInsideTableOrFencedCode(lines, 1)).toBe(true);
  });

  test("rejects when line is in a normal paragraph (no separator nearby)", () => {
    const lines = [
      "## Section",
      "",
      "Just prose with ^block-id at the end.",
      "",
      "## Other",
    ];
    expect(isInsideTableOrFencedCode(lines, 2)).toBe(false);
  });

  test("rejects when line starts with `|` but no separator above/below (false-positive guard)", () => {
    const lines = [
      "## Section",
      "",
      "| stray pipe content but not a real table",
      "",
      "## Other",
    ];
    expect(isInsideTableOrFencedCode(lines, 2)).toBe(false);
  });

  test("detects line inside a fenced code block", () => {
    const lines = [
      "## Section",
      "",
      "```",
      "code line ^block-id",
      "```",
      "",
      "End.",
    ];
    expect(isInsideTableOrFencedCode(lines, 3)).toBe(true);
  });

  test("rejects when fenced code block is closed before the target line", () => {
    const lines = [
      "## Section",
      "",
      "```",
      "code line",
      "```",
      "",
      "Plain prose with ^block-id.",
    ];
    expect(isInsideTableOrFencedCode(lines, 6)).toBe(false);
  });

  test("detects table with alignment colons in separator", () => {
    const lines = [
      "| Col | Data |",
      "|:----|----:|",
      "| a   | b   |",
    ];
    expect(isInsideTableOrFencedCode(lines, 2)).toBe(true);
  });

  test("returns false for out-of-range indices", () => {
    const lines = ["a", "b"];
    expect(isInsideTableOrFencedCode(lines, -1)).toBe(false);
    expect(isInsideTableOrFencedCode(lines, 99)).toBe(false);
  });
});
