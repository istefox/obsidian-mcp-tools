import { describe, expect, test, beforeEach } from "bun:test";
import { appendToVaultFileHandler, appendToVaultFileSchema } from "./appendToVaultFile";
import { mockApp, resetMockVault, setMockFile } from "$/test-setup";

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

  test("creates file if missing", async () => {
    const app = mockApp();
    const result = await appendToVaultFileHandler({
      arguments: { path: "New/empty.md", content: "First" },
      app,
    });
    expect(result.isError).toBeUndefined();
    const file = app.vault.getAbstractFileByPath("New/empty.md");
    expect(file).not.toBeNull();
    expect(await app.vault.read(file as never)).toBe("First\n\n");
  });
});
