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

  // ── Heading-replace blank-line preservation ───────────────────────────

  test("regression: replace on heading section preserves blank line before next heading", async () => {
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
    // Must keep the blank line between the patched section and ## B.
    expect(final).toContain("## A\nnew\n\n## B");
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
