import { describe, expect, test, beforeEach } from "bun:test";
import { deleteVaultFileHandler, deleteVaultFileSchema } from "./deleteVaultFile";
import { mockApp, resetMockVault, setMockFile } from "$/test-setup";

beforeEach(() => resetMockVault());

describe("delete_vault_file tool", () => {
  test("schema declares the tool name", () => {
    expect(deleteVaultFileSchema.get("name")?.toString()).toContain("delete_vault_file");
  });

  test("deletes existing file", async () => {
    setMockFile("trash.md", "junk");
    const app = mockApp();
    const result = await deleteVaultFileHandler({
      arguments: { path: "trash.md" },
      app,
    });
    expect(result.isError).toBeUndefined();
    expect(app.vault.getAbstractFileByPath("trash.md")).toBeNull();
  });

  test("returns error when path not found", async () => {
    const app = mockApp();
    const result = await deleteVaultFileHandler({
      arguments: { path: "nope.md" },
      app,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/not found/i);
  });
});
