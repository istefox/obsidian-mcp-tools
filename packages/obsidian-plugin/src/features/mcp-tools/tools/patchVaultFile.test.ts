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
