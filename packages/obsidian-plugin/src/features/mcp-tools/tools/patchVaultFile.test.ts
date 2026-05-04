import { describe, expect, test, beforeEach } from "bun:test";
import { patchVaultFileHandler, patchVaultFileSchema } from "./patchVaultFile";
import {
  mockApp,
  resetMockVault,
  setMockFile,
  setMockMetadata,
} from "$/test-setup";

beforeEach(() => resetMockVault());

describe("patch_vault_file tool", () => {
  test("schema declares the tool name", () => {
    expect(patchVaultFileSchema.get("name")?.toString()).toContain("patch_vault_file");
  });

  test("patches heading on arbitrary path", async () => {
    setMockFile("Notes/x.md", "# Top\n\n## A\n\noldA\n");
    const app = mockApp();
    const result = await patchVaultFileHandler({
      arguments: {
        path: "Notes/x.md",
        operation: "append",
        targetType: "heading",
        target: "A",
        content: "newA",
      },
      app,
    });
    expect(result.isError).toBeUndefined();
    const file = app.vault.getAbstractFileByPath("Notes/x.md");
    if (!file) throw new Error("expected file");
    const final = await app.vault.read(file as never);
    expect(final).toContain("oldA");
    expect(final).toContain("newA");
  });

  test("patches frontmatter on arbitrary path", async () => {
    setMockFile("Notes/x.md", "---\nstatus: draft\n---\n# Body");
    setMockMetadata("Notes/x.md", { frontmatter: { status: "draft" } });
    const app = mockApp();
    const result = await patchVaultFileHandler({
      arguments: {
        path: "Notes/x.md",
        operation: "replace",
        targetType: "frontmatter",
        target: "status",
        content: "published",
      },
      app,
    });
    expect(result.isError).toBeUndefined();
    const file = app.vault.getAbstractFileByPath("Notes/x.md");
    const cache = app.metadataCache.getFileCache(file as never);
    expect(cache?.frontmatter?.status).toBe("published");
  });

  test("returns error when path not found", async () => {
    const result = await patchVaultFileHandler({
      arguments: {
        path: "missing.md",
        operation: "append",
        targetType: "heading",
        target: "X",
        content: "Y",
      },
      app: mockApp(),
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/not found/i);
  });

  // ── Frontmatter regression coverage (issues #12, #13) ─────────────────

  test("issue #12: replace on array-valued frontmatter with scalar content → typed reject, file untouched", async () => {
    setMockFile("Notes/x.md", "---\ntags:\n  - alpha\n  - beta\n---\nbody\n");
    setMockMetadata("Notes/x.md", {
      frontmatter: { tags: ["alpha", "beta"] },
    });
    const app = mockApp();
    const result = await patchVaultFileHandler({
      arguments: {
        path: "Notes/x.md",
        operation: "replace",
        targetType: "frontmatter",
        target: "tags",
        content: "gamma",
      },
      app,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/array/i);
    expect(result.content[0].text).toContain("tags");

    // File frontmatter must remain intact — no silent coercion to scalar.
    const file = app.vault.getAbstractFileByPath("Notes/x.md");
    const cache = app.metadataCache.getFileCache(file as never);
    expect(cache?.frontmatter?.tags).toEqual(["alpha", "beta"]);
  });

  test("replace on array-valued frontmatter with JSON array content succeeds", async () => {
    setMockFile("Notes/x.md", "---\ntags:\n  - a\n---\nbody\n");
    setMockMetadata("Notes/x.md", { frontmatter: { tags: ["a"] } });
    const app = mockApp();
    const result = await patchVaultFileHandler({
      arguments: {
        path: "Notes/x.md",
        operation: "replace",
        targetType: "frontmatter",
        target: "tags",
        content: '["b","c"]',
      },
      app,
    });
    expect(result.isError).toBeUndefined();
    const file = app.vault.getAbstractFileByPath("Notes/x.md");
    const cache = app.metadataCache.getFileCache(file as never);
    expect(cache?.frontmatter?.tags).toEqual(["b", "c"]);
  });

  test("replace on array-valued frontmatter with JSON null clears the field", async () => {
    setMockFile("Notes/x.md", "---\ntags:\n  - a\n---\n");
    setMockMetadata("Notes/x.md", { frontmatter: { tags: ["a"] } });
    const app = mockApp();
    const result = await patchVaultFileHandler({
      arguments: {
        path: "Notes/x.md",
        operation: "replace",
        targetType: "frontmatter",
        target: "tags",
        content: "null",
      },
      app,
    });
    expect(result.isError).toBeUndefined();
    const file = app.vault.getAbstractFileByPath("Notes/x.md");
    const cache = app.metadataCache.getFileCache(file as never);
    expect(cache?.frontmatter?.tags).toBeNull();
  });

  test("issue #13: append on array-valued frontmatter with plain string pushes as element", async () => {
    setMockFile("Notes/x.md", "---\ntags:\n  - existing\n---\n");
    setMockMetadata("Notes/x.md", { frontmatter: { tags: ["existing"] } });
    const app = mockApp();
    const result = await patchVaultFileHandler({
      arguments: {
        path: "Notes/x.md",
        operation: "append",
        targetType: "frontmatter",
        target: "tags",
        content: "new-tag",
      },
      app,
    });
    expect(result.isError).toBeUndefined();
    const file = app.vault.getAbstractFileByPath("Notes/x.md");
    const cache = app.metadataCache.getFileCache(file as never);
    expect(cache?.frontmatter?.tags).toEqual(["existing", "new-tag"]);
  });

  test("issue #13: append on array-valued frontmatter with JSON scalar content pushes parsed scalar", async () => {
    setMockFile("Notes/x.md", "---\ntags:\n  - existing\n---\n");
    setMockMetadata("Notes/x.md", { frontmatter: { tags: ["existing"] } });
    const app = mockApp();
    const result = await patchVaultFileHandler({
      arguments: {
        path: "Notes/x.md",
        operation: "append",
        targetType: "frontmatter",
        target: "tags",
        content: '"new-tag"',
      },
      app,
    });
    expect(result.isError).toBeUndefined();
    const file = app.vault.getAbstractFileByPath("Notes/x.md");
    const cache = app.metadataCache.getFileCache(file as never);
    expect(cache?.frontmatter?.tags).toEqual(["existing", "new-tag"]);
  });

  test("append on array-valued frontmatter with JSON array content spreads elements", async () => {
    setMockFile("Notes/x.md", "---\ntags:\n  - a\n---\n");
    setMockMetadata("Notes/x.md", { frontmatter: { tags: ["a"] } });
    const app = mockApp();
    const result = await patchVaultFileHandler({
      arguments: {
        path: "Notes/x.md",
        operation: "append",
        targetType: "frontmatter",
        target: "tags",
        content: '["b","c"]',
      },
      app,
    });
    expect(result.isError).toBeUndefined();
    const file = app.vault.getAbstractFileByPath("Notes/x.md");
    const cache = app.metadataCache.getFileCache(file as never);
    expect(cache?.frontmatter?.tags).toEqual(["a", "b", "c"]);
  });

  test("prepend on array-valued frontmatter unshifts the parsed value", async () => {
    setMockFile("Notes/x.md", "---\ntags:\n  - tail\n---\n");
    setMockMetadata("Notes/x.md", { frontmatter: { tags: ["tail"] } });
    const app = mockApp();
    const result = await patchVaultFileHandler({
      arguments: {
        path: "Notes/x.md",
        operation: "prepend",
        targetType: "frontmatter",
        target: "tags",
        content: '"head"',
      },
      app,
    });
    expect(result.isError).toBeUndefined();
    const file = app.vault.getAbstractFileByPath("Notes/x.md");
    const cache = app.metadataCache.getFileCache(file as never);
    expect(cache?.frontmatter?.tags).toEqual(["head", "tail"]);
  });

  test("append on missing frontmatter field with plain content creates the scalar", async () => {
    // existing is undefined → string-concat path → assigns content verbatim
    setMockFile("Notes/x.md", "---\n---\n");
    setMockMetadata("Notes/x.md", { frontmatter: {} });
    const app = mockApp();
    const result = await patchVaultFileHandler({
      arguments: {
        path: "Notes/x.md",
        operation: "append",
        targetType: "frontmatter",
        target: "status",
        content: "draft",
      },
      app,
    });
    expect(result.isError).toBeUndefined();
    const file = app.vault.getAbstractFileByPath("Notes/x.md");
    const cache = app.metadataCache.getFileCache(file as never);
    expect(cache?.frontmatter?.status).toBe("draft");
  });

  // ── Heading-replace blank-line preservation (issue #76) ───────────────
  //
  // Symmetric blank-line emission on the `replace` branch: both the leading
  // separator (between the heading line and the new body) and the trailing
  // separator (between the new body and the next sibling heading) are
  // re-emitted unless the content already supplies them. Matches 0.3.x
  // behaviour and the Linter-normalised shape, so that MCP-driven edits do
  // not diverge from UI-driven edits in raw view.

  test("issue #76: replace on heading section emits leading blank between heading and new body", async () => {
    setMockFile("Notes/h.md", "## A\n\nold\n\n## B\n");
    const app = mockApp();
    const result = await patchVaultFileHandler({
      arguments: {
        path: "Notes/h.md",
        operation: "replace",
        targetType: "heading",
        target: "A",
        content: "new",
      },
      app,
    });
    expect(result.isError).toBeUndefined();
    const file = app.vault.getAbstractFileByPath("Notes/h.md");
    if (!file) throw new Error("expected file");
    const final = await app.vault.read(file as never);
    // Must keep blank lines on BOTH sides of the patched body.
    expect(final).toContain("## A\n\nnew\n\n## B");
  });

  test("issue #76: replace on heading section emits leading blank even when input has none (normalises to Linter shape)", async () => {
    setMockFile("Notes/h.md", "## A\nold\n\n## B\n");
    const app = mockApp();
    const result = await patchVaultFileHandler({
      arguments: {
        path: "Notes/h.md",
        operation: "replace",
        targetType: "heading",
        target: "A",
        content: "new",
      },
      app,
    });
    expect(result.isError).toBeUndefined();
    const file = app.vault.getAbstractFileByPath("Notes/h.md");
    if (!file) throw new Error("expected file");
    const final = await app.vault.read(file as never);
    // Even when the input had heading and body adjacent, the replace emits
    // the Linter-correct shape — symmetric with the trailing-separator fix
    // which already normalises regardless of input shape.
    expect(final).toContain("## A\n\nnew\n\n## B");
  });

  test("issue #76: replace on heading section does NOT double-emit when content already starts with blank", async () => {
    setMockFile("Notes/h.md", "## A\n\nold\n\n## B\n");
    const app = mockApp();
    const result = await patchVaultFileHandler({
      arguments: {
        path: "Notes/h.md",
        operation: "replace",
        targetType: "heading",
        target: "A",
        content: "\nnew",
      },
      app,
    });
    expect(result.isError).toBeUndefined();
    const file = app.vault.getAbstractFileByPath("Notes/h.md");
    if (!file) throw new Error("expected file");
    const final = await app.vault.read(file as never);
    // Caller-supplied leading newline is respected: do not produce
    // `## A\n\n\nnew` (which would render as two consecutive blanks).
    expect(final).toContain("## A\n\nnew\n\n## B");
    expect(final).not.toContain("## A\n\n\nnew");
  });

  test("regression: block target with createTargetIfMissing=false on table-located block fails loud", async () => {
    // Simulates upstream #71: block id ^X exists in markdown table cell,
    // but Obsidian's metadataCache.blocks does NOT index blocks inside tables.
    // Our findBlockPositionFromCache returns null → with default
    // createTargetIfMissing=false (block-specific), we fail loud.
    setMockFile("a.md", "| col |\n| --- |\n| ^X data |\n");
    setMockMetadata("a.md", { blocks: {} });
    const app = mockApp();
    const result = await patchVaultFileHandler({
      arguments: {
        path: "a.md",
        operation: "append",
        targetType: "block",
        target: "X",
        content: "boom",
      },
      app,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/block.*not found|unresolved/i);
  });
});

// ─── Regression rejects: 0.4.x parity with 0.3.x legacy chain ─────────────
//
// Both surfaced by folotp during the round-3 retest on the actual
// HTTP-embedded chain after the chain mis-identification was corrected
// (jacksteamdev/obsidian-mcp-tools#83). See fork issues #80 and #81.

describe("patch_vault_file — H2-root reject (#80)", () => {
  test("rejects level-2 root-orphan heading replace when createTargetIfMissing=false (folotp R1)", async () => {
    // Folotp's fixture verbatim: a root-level H2 with no H1 parent.
    setMockFile("Notes/r1.md", "## RootHeading\n\nBody content.\n");
    const app = mockApp();
    const result = await patchVaultFileHandler({
      arguments: {
        path: "Notes/r1.md",
        operation: "replace",
        targetType: "heading",
        target: "RootHeading",
        createTargetIfMissing: false,
        content: "REPLACED.\n",
      },
      app,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/level-2 heading at the root/i);
    // File content must be unchanged.
    const file = app.vault.getAbstractFileByPath("Notes/r1.md");
    if (!file) throw new Error("expected file");
    const final = await app.vault.read(file as never);
    expect(final).toBe("## RootHeading\n\nBody content.\n");
  });

  test("succeeds on H2 nested under H1 (control: not root-orphan)", async () => {
    setMockFile("Notes/r1c.md", "# Top\n\n## Sub\n\nBody.\n");
    const app = mockApp();
    const result = await patchVaultFileHandler({
      arguments: {
        path: "Notes/r1c.md",
        operation: "replace",
        targetType: "heading",
        target: "Sub",
        createTargetIfMissing: false,
        content: "REPLACED.\n",
      },
      app,
    });
    expect(result.isError).toBeUndefined();
  });

  test("bypasses reject when createTargetIfMissing=true (default for heading)", async () => {
    setMockFile("Notes/r1b.md", "## RootHeading\n\nBody.\n");
    const app = mockApp();
    const result = await patchVaultFileHandler({
      arguments: {
        path: "Notes/r1b.md",
        operation: "replace",
        targetType: "heading",
        target: "RootHeading",
        createTargetIfMissing: true,
        content: "REPLACED.\n",
      },
      app,
    });
    expect(result.isError).toBeUndefined();
  });

  test("rejects level-3 root-orphan heading symmetrically (parity)", async () => {
    setMockFile("Notes/r1d.md", "### Deep\n\nBody.\n");
    const app = mockApp();
    const result = await patchVaultFileHandler({
      arguments: {
        path: "Notes/r1d.md",
        operation: "replace",
        targetType: "heading",
        target: "Deep",
        createTargetIfMissing: false,
        content: "X.\n",
      },
      app,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/level-3 heading at the root/i);
  });
});

describe("patch_vault_file — block-in-table / fenced-code reject (#81)", () => {
  test("rejects block-in-table replace and preserves the file (folotp R2)", async () => {
    // Folotp's fixture verbatim. The metadataCache reports the block at the
    // data-row line — Obsidian newer versions do index inside-table blocks
    // (the legacy "tables aren't indexed" comment in #71 has shifted),
    // which is what made this regression surface in the first place.
    const fixture =
      "## Section\n\n| Col | Data |\n| --- | --- |\n| a   | b ^cell-id |\n";
    setMockFile("Notes/r2.md", fixture);
    setMockMetadata("Notes/r2.md", {
      blocks: {
        "cell-id": { startLine: 4, endLine: 4 },
      },
    });
    const app = mockApp();
    const result = await patchVaultFileHandler({
      arguments: {
        path: "Notes/r2.md",
        operation: "replace",
        targetType: "block",
        target: "cell-id",
        createTargetIfMissing: false,
        content: "X.\n",
      },
      app,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/markdown table or fenced code block/i);
    // File content must be unchanged — this is the vault-safety property.
    const file = app.vault.getAbstractFileByPath("Notes/r2.md");
    if (!file) throw new Error("expected file");
    const final = await app.vault.read(file as never);
    expect(final).toBe(fixture);
  });

  test("rejects block-in-fenced-code replace symmetrically", async () => {
    const fixture =
      "## Section\n\n```\ncode line ^block-id\n```\n\nEnd.\n";
    setMockFile("Notes/r2f.md", fixture);
    setMockMetadata("Notes/r2f.md", {
      blocks: {
        "block-id": { startLine: 3, endLine: 3 },
      },
    });
    const app = mockApp();
    const result = await patchVaultFileHandler({
      arguments: {
        path: "Notes/r2f.md",
        operation: "replace",
        targetType: "block",
        target: "block-id",
        createTargetIfMissing: false,
        content: "X.\n",
      },
      app,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/markdown table or fenced code block/i);
    const file = app.vault.getAbstractFileByPath("Notes/r2f.md");
    if (!file) throw new Error("expected file");
    expect(await app.vault.read(file as never)).toBe(fixture);
  });

  test("succeeds on block in normal paragraph (control)", async () => {
    setMockFile(
      "Notes/r2c.md",
      "## Section\n\nFirst paragraph.\n^my-block\n\nSecond.\n",
    );
    setMockMetadata("Notes/r2c.md", {
      blocks: {
        "my-block": { startLine: 2, endLine: 3 },
      },
    });
    const app = mockApp();
    const result = await patchVaultFileHandler({
      arguments: {
        path: "Notes/r2c.md",
        operation: "replace",
        targetType: "block",
        target: "my-block",
        createTargetIfMissing: false,
        content: "REPLACED.\n",
      },
      app,
    });
    expect(result.isError).toBeUndefined();
  });

  test("rejects symmetrically on append/prepend (gate runs before op dispatch)", async () => {
    const fixture =
      "## Section\n\n| Col | Data |\n| --- | --- |\n| a   | b ^cell-id |\n";
    setMockFile("Notes/r2a.md", fixture);
    setMockMetadata("Notes/r2a.md", {
      blocks: {
        "cell-id": { startLine: 4, endLine: 4 },
      },
    });
    const app = mockApp();
    const r = await patchVaultFileHandler({
      arguments: {
        path: "Notes/r2a.md",
        operation: "append",
        targetType: "block",
        target: "cell-id",
        createTargetIfMissing: false,
        content: "X",
      },
      app,
    });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/markdown table or fenced code block/i);
  });
});
