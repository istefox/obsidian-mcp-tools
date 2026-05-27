import { describe, expect, test } from "bun:test";
import { detectNonAsciiRatio } from "./langDetect";
import type { VaultLike } from "./indexer";

function makeVault(contents: Record<string, string>): VaultLike {
  const files = new Map(Object.entries(contents));
  return {
    getMarkdownFiles: () => Array.from(files.keys()).map((path) => ({ path })),
    read: async (path) => {
      const v = files.get(path);
      if (v === undefined) throw new Error(`ENOENT ${path}`);
      return v;
    },
    on: () => () => undefined,
  };
}

describe("detectNonAsciiRatio", () => {
  test("empty vault returns 0", async () => {
    const vault = makeVault({});
    expect(await detectNonAsciiRatio(vault)).toBe(0);
  });

  test("all-ASCII content returns 0", async () => {
    const vault = makeVault({
      "a.md": "Hello world! This is a plain English note.",
      "b.md": "More plain text with numbers 1234 and symbols !@#.",
    });
    expect(await detectNonAsciiRatio(vault)).toBe(0);
  });

  test("CJK-heavy vault returns ratio above 0.30", async () => {
    // Japanese text — every character is non-ASCII.
    const vault = makeVault({
      "a.md": "日本語のノートです。検索機能を使います。",
      "b.md": "もう一つの日本語のノートです。",
    });
    const ratio = await detectNonAsciiRatio(vault);
    expect(ratio).toBeGreaterThan(0.3);
  });

  test("mixed content: ratio is proportional to non-ASCII fraction", async () => {
    // 4 ASCII chars + 4 non-ASCII (e.g. é, ü, ñ, ç) → ratio = 0.5.
    const vault = makeVault({ "a.md": "abcdéüñç" });
    const ratio = await detectNonAsciiRatio(vault);
    expect(ratio).toBeCloseTo(0.5, 2);
  });

  test("respects sampleSize: only first N files are read", async () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 10; i++) {
      files[`${i}.md`] = "ASCII only";
    }
    // Inject a non-ASCII file beyond sampleSize=5.
    files["9.md"] = "日本語";
    const vault = makeVault(files);
    // With sampleSize=5, only files 0-4 are sampled (all ASCII).
    const ratio = await detectNonAsciiRatio(vault, 5);
    expect(ratio).toBe(0);
  });

  test("read errors are skipped gracefully", async () => {
    const vault: VaultLike = {
      getMarkdownFiles: () => [{ path: "bad.md" }, { path: "good.md" }],
      read: async (path) => {
        if (path === "bad.md") throw new Error("EBUSY");
        return "ASCII text";
      },
      on: () => () => undefined,
    };
    // bad.md is skipped; good.md is all ASCII → ratio 0.
    expect(await detectNonAsciiRatio(vault)).toBe(0);
  });
});
