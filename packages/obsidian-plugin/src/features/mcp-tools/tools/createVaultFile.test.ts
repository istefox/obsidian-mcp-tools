import { describe, expect, test, beforeEach } from "bun:test";
import { createVaultFileHandler, createVaultFileSchema } from "./createVaultFile";
import { mockApp, resetMockVault, setMockFile } from "$/test-setup";

beforeEach(() => resetMockVault());

describe("create_vault_file tool", () => {
  test("schema declares the tool name", () => {
    expect(createVaultFileSchema.get("name")?.toString()).toContain(
      "create_vault_file",
    );
  });

  test("creates new file at path", async () => {
    const app = mockApp();
    const result = await createVaultFileHandler({
      arguments: { path: "New/note.md", content: "# Hi" },
      app,
    });
    expect(result.isError).toBeUndefined();

    const file = app.vault.getAbstractFileByPath("New/note.md");
    expect(file).not.toBeNull();
    expect(await app.vault.read(file as never)).toBe("# Hi");
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
