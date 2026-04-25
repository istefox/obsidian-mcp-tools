import { describe, expect, test } from "bun:test";
import {
  resolveHeadingPath,
  normalizeAppendBody,
  findBlockReferenceInContent,
  findBlockPositionFromCache,
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
