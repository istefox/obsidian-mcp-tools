import { describe, expect, test, beforeEach } from "bun:test";
import { createVaultFileHandler, createVaultFileSchema } from "./createVaultFile";
import {
  getMockFolders,
  mockApp,
  resetMockVault,
  setMockFile,
  setMockFolder,
} from "$/test-setup";

beforeEach(() => resetMockVault());

describe("create_vault_file tool", () => {
  test("schema declares the tool name", () => {
    expect(createVaultFileSchema.get("name")?.toString()).toContain(
      "create_vault_file",
    );
  });

  test("creates new file at root path", async () => {
    const app = mockApp();
    const result = await createVaultFileHandler({
      arguments: { path: "note.md", content: "# Hi" },
      app,
    });
    expect(result.isError).toBeUndefined();
    const file = app.vault.getAbstractFileByPath("note.md");
    expect(file).not.toBeNull();
    expect(await app.vault.read(file as never)).toBe("# Hi");
  });

  test("auto-creates single-level missing parent directory (#86)", async () => {
    const app = mockApp();
    const result = await createVaultFileHandler({
      arguments: { path: "New/note.md", content: "# Hi" },
      app,
    });
    expect(result.isError).toBeUndefined();
    expect(getMockFolders()).toContain("New");
    const file = app.vault.getAbstractFileByPath("New/note.md");
    expect(file).not.toBeNull();
    expect(await app.vault.read(file as never)).toBe("# Hi");
  });

  test("auto-creates multi-level missing parent chain (#86)", async () => {
    const app = mockApp();
    const result = await createVaultFileHandler({
      arguments: { path: "A/B/C/deep.md", content: "deep" },
      app,
    });
    expect(result.isError).toBeUndefined();
    // Every ancestor was created in order, root-first.
    expect(getMockFolders()).toEqual(["A", "A/B", "A/B/C"]);
    const file = app.vault.getAbstractFileByPath("A/B/C/deep.md");
    expect(file).not.toBeNull();
  });

  test("partial existing chain — only creates the missing tail (#86)", async () => {
    setMockFolder("A");
    setMockFolder("A/B");
    const app = mockApp();
    const result = await createVaultFileHandler({
      arguments: { path: "A/B/C/note.md", content: "hi" },
      app,
    });
    expect(result.isError).toBeUndefined();
    expect(getMockFolders()).toEqual(["A", "A/B", "A/B/C"]);
  });

  test("idempotent when parent already exists (no createFolder call needed)", async () => {
    setMockFolder("Existing");
    const app = mockApp();
    const result = await createVaultFileHandler({
      arguments: { path: "Existing/note.md", content: "x" },
      app,
    });
    expect(result.isError).toBeUndefined();
    expect(getMockFolders()).toEqual(["Existing"]);
  });

  test("overwrites existing file when target exists", async () => {
    setMockFile("a.md", "OLD");
    const app = mockApp();
    const result = await createVaultFileHandler({
      arguments: { path: "a.md", content: "NEW" },
      app,
    });
    expect(result.isError).toBeUndefined();
    const file = app.vault.getAbstractFileByPath("a.md");
    expect(await app.vault.read(file as never)).toBe("NEW");
  });
});
