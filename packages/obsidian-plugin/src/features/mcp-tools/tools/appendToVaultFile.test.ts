import { describe, expect, test, beforeEach } from "bun:test";
import { appendToVaultFileHandler, appendToVaultFileSchema } from "./appendToVaultFile";
import {
  getMockFolders,
  mockApp,
  resetMockVault,
  setMockFile,
  setMockFolder,
} from "$/test-setup";

beforeEach(() => resetMockVault());

describe("append_to_vault_file tool", () => {
  test("schema declares the tool name", () => {
    expect(appendToVaultFileSchema.get("name")?.toString()).toContain("append_to_vault_file");
  });

  test("appends to existing file with newline normalization", async () => {
    setMockFile("Notes/log.md", "Line1");
    const app = mockApp();
    const result = await appendToVaultFileHandler({
      arguments: { path: "Notes/log.md", content: "Line2" },
      app,
    });
    expect(result.isError).toBeUndefined();
    const file = app.vault.getAbstractFileByPath("Notes/log.md");
    if (!file) throw new Error("expected file");
    expect(await app.vault.read(file as never)).toBe("Line1Line2\n\n");
  });

  test("creates file at root if missing", async () => {
    const app = mockApp();
    const result = await appendToVaultFileHandler({
      arguments: { path: "empty.md", content: "First" },
      app,
    });
    expect(result.isError).toBeUndefined();
    const file = app.vault.getAbstractFileByPath("empty.md");
    expect(file).not.toBeNull();
    expect(await app.vault.read(file as never)).toBe("First\n\n");
  });

  test("auto-creates missing parent directories on the create branch (#86)", async () => {
    const app = mockApp();
    const result = await appendToVaultFileHandler({
      arguments: { path: "Logs/2026/05/today.md", content: "First" },
      app,
    });
    expect(result.isError).toBeUndefined();
    expect(getMockFolders()).toEqual(["Logs", "Logs/2026", "Logs/2026/05"]);
    const file = app.vault.getAbstractFileByPath("Logs/2026/05/today.md");
    expect(file).not.toBeNull();
    expect(await app.vault.read(file as never)).toBe("First\n\n");
  });

  test("does NOT call createFolder on the modify branch — folder set unchanged", async () => {
    setMockFolder("Notes");
    setMockFile("Notes/log.md", "Line1");
    const app = mockApp();
    await appendToVaultFileHandler({
      arguments: { path: "Notes/log.md", content: "Line2" },
      app,
    });
    expect(getMockFolders()).toEqual(["Notes"]);
  });
});
