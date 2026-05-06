import { describe, expect, test, beforeEach } from "bun:test";
import {
  deleteVaultDirectoryHandler,
  deleteVaultDirectorySchema,
} from "./deleteVaultDirectory";
import {
  getMockFolders,
  mockApp,
  resetMockVault,
  setMockFile,
  setMockFolder,
} from "$/test-setup";

beforeEach(() => resetMockVault());

describe("delete_vault_directory tool", () => {
  test("schema declares the tool name", () => {
    expect(deleteVaultDirectorySchema.get("name")?.toString()).toContain(
      "delete_vault_directory",
    );
  });

  test("deletes an empty directory (default recursive=false)", async () => {
    setMockFolder("Empty");
    const app = mockApp();
    const result = await deleteVaultDirectoryHandler({
      arguments: { path: "Empty" },
      app,
    });
    expect(result.isError).toBeUndefined();
    expect(getMockFolders()).toEqual([]);
  });

  test("fails on non-empty directory when recursive=false", async () => {
    setMockFolder("Notes");
    setMockFile("Notes/a.md", "x");
    const app = mockApp();
    const result = await deleteVaultDirectoryHandler({
      arguments: { path: "Notes" },
      app,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/not empty/i);
    // Folder + file must still be there.
    expect(getMockFolders()).toEqual(["Notes"]);
    expect(app.vault.getAbstractFileByPath("Notes/a.md")).not.toBeNull();
  });

  test("recursive=true removes folder, child folders, and child files", async () => {
    setMockFolder("Archive");
    setMockFolder("Archive/2025");
    setMockFolder("Archive/2025/Q1");
    setMockFile("Archive/2025/old.md", "");
    setMockFile("Archive/2025/Q1/note.md", "");
    const app = mockApp();
    const result = await deleteVaultDirectoryHandler({
      arguments: { path: "Archive", recursive: "true" },
      app,
    });
    expect(result.isError).toBeUndefined();
    expect(getMockFolders()).toEqual([]);
    expect(app.vault.getAbstractFileByPath("Archive/2025/old.md")).toBeNull();
    expect(app.vault.getAbstractFileByPath("Archive/2025/Q1/note.md")).toBeNull();
  });

  test("returns error if directory does not exist", async () => {
    const app = mockApp();
    const result = await deleteVaultDirectoryHandler({
      arguments: { path: "ghost" },
      app,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/failed to delete/i);
  });

  test("rejects when path is a file (use delete_vault_file instead)", async () => {
    setMockFile("note.md", "");
    const app = mockApp();
    const result = await deleteVaultDirectoryHandler({
      arguments: { path: "note.md" },
      app,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/delete_vault_file/);
  });

  test("rejects empty / root path", async () => {
    const app = mockApp();
    const result = await deleteVaultDirectoryHandler({
      arguments: { path: "/" },
      app,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/empty/i);
  });

  test("trims leading and trailing slashes", async () => {
    setMockFolder("Trash");
    const app = mockApp();
    const result = await deleteVaultDirectoryHandler({
      arguments: { path: "/Trash/" },
      app,
    });
    expect(result.isError).toBeUndefined();
    expect(getMockFolders()).toEqual([]);
  });
});
