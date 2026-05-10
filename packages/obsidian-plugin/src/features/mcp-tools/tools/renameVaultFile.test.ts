import { describe, expect, test, beforeEach } from "bun:test";
import {
  renameVaultFileHandler,
  renameVaultFileSchema,
} from "./renameVaultFile";
import {
  mockApp,
  resetMockVault,
  setMockFile,
  setMockFolder,
} from "$/test-setup";

beforeEach(() => resetMockVault());

describe("rename_vault_file tool", () => {
  test("schema declares the tool name", () => {
    expect(renameVaultFileSchema.get("name")?.toString()).toContain(
      "rename_vault_file",
    );
  });

  test("renames file at root level", async () => {
    setMockFile("old.md", "content");
    const app = mockApp();
    const result = await renameVaultFileHandler({
      arguments: { from: "old.md", to: "new.md" },
      app,
    });
    expect(result.isError).toBeUndefined();
    expect(app.vault.getAbstractFileByPath("old.md")).toBeNull();
    const moved = app.vault.getAbstractFileByPath("new.md");
    expect(moved).not.toBeNull();
    expect(await app.vault.read(moved as never)).toBe("content");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toEqual({ ok: true, path: "new.md" });
  });

  test("moves file across existing directories", async () => {
    setMockFolder("Source");
    setMockFolder("Dest");
    setMockFile("Source/note.md", "x");
    const app = mockApp();
    const result = await renameVaultFileHandler({
      arguments: { from: "Source/note.md", to: "Dest/note.md" },
      app,
    });
    expect(result.isError).toBeUndefined();
    expect(app.vault.getAbstractFileByPath("Source/note.md")).toBeNull();
    expect(app.vault.getAbstractFileByPath("Dest/note.md")).not.toBeNull();
  });

  test("returns error when source does not exist", async () => {
    const app = mockApp();
    const result = await renameVaultFileHandler({
      arguments: { from: "missing.md", to: "wherever.md" },
      app,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/source file not found/i);
  });

  test("returns error when destination already exists", async () => {
    setMockFile("a.md", "old");
    setMockFile("b.md", "blocking");
    const app = mockApp();
    const result = await renameVaultFileHandler({
      arguments: { from: "a.md", to: "b.md" },
      app,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/destination already exists/i);
    // Source untouched, destination untouched
    expect(app.vault.getAbstractFileByPath("a.md")).not.toBeNull();
    const aFile = app.vault.getAbstractFileByPath("a.md");
    expect(await app.vault.read(aFile as never)).toBe("old");
    const bFile = app.vault.getAbstractFileByPath("b.md");
    expect(await app.vault.read(bFile as never)).toBe("blocking");
  });

  test("returns error when destination parent does not exist (no auto-create)", async () => {
    setMockFile("note.md", "x");
    const app = mockApp();
    const result = await renameVaultFileHandler({
      arguments: { from: "note.md", to: "Missing/Folder/note.md" },
      app,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/parent directory does not exist/i);
    // Source untouched, no folder auto-created
    expect(app.vault.getAbstractFileByPath("note.md")).not.toBeNull();
    expect(app.vault.getAbstractFileByPath("Missing")).toBeNull();
    expect(app.vault.getAbstractFileByPath("Missing/Folder")).toBeNull();
  });

  test("returns error when source and destination are identical", async () => {
    setMockFile("note.md", "x");
    const app = mockApp();
    const result = await renameVaultFileHandler({
      arguments: { from: "note.md", to: "note.md" },
      app,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/identical/i);
    // File untouched
    expect(app.vault.getAbstractFileByPath("note.md")).not.toBeNull();
  });

  test("surfaces fileManager.renameFile rejection verbatim", async () => {
    setMockFile("a.md", "x");
    const app = mockApp();
    (
      app.fileManager as unknown as {
        renameFile: (...args: unknown[]) => Promise<void>;
      }
    ).renameFile = async () => {
      throw new Error("simulated obsidian failure");
    };
    const result = await renameVaultFileHandler({
      arguments: { from: "a.md", to: "b.md" },
      app,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/simulated obsidian failure/i);
  });
});
