import { describe, expect, test, beforeEach } from "bun:test";
import {
  createVaultDirectoryHandler,
  createVaultDirectorySchema,
} from "./createVaultDirectory";
import {
  getMockFolders,
  mockApp,
  resetMockVault,
  setMockFile,
  setMockFolder,
} from "$/test-setup";

beforeEach(() => resetMockVault());

describe("create_vault_directory tool", () => {
  test("schema declares the tool name", () => {
    expect(createVaultDirectorySchema.get("name")?.toString()).toContain(
      "create_vault_directory",
    );
  });

  test("creates a single new directory", async () => {
    const app = mockApp();
    const result = await createVaultDirectoryHandler({
      arguments: { path: "Inbox" },
      app,
    });
    expect(result.isError).toBeUndefined();
    expect(getMockFolders()).toEqual(["Inbox"]);
  });

  test("creates a nested chain (mkdirp)", async () => {
    const app = mockApp();
    const result = await createVaultDirectoryHandler({
      arguments: { path: "Projects/2026/Q2" },
      app,
    });
    expect(result.isError).toBeUndefined();
    expect(getMockFolders()).toEqual(["Projects", "Projects/2026", "Projects/2026/Q2"]);
  });

  test("idempotent — succeeds when directory already exists", async () => {
    setMockFolder("Inbox");
    const app = mockApp();
    const result = await createVaultDirectoryHandler({
      arguments: { path: "Inbox" },
      app,
    });
    expect(result.isError).toBeUndefined();
    expect(getMockFolders()).toEqual(["Inbox"]);
  });

  test("normalises leading and trailing slashes", async () => {
    const app = mockApp();
    const result = await createVaultDirectoryHandler({
      arguments: { path: "/Projects/A/" },
      app,
    });
    expect(result.isError).toBeUndefined();
    expect(getMockFolders()).toEqual(["Projects", "Projects/A"]);
  });

  test("rejects empty path after trimming", async () => {
    const app = mockApp();
    const result = await createVaultDirectoryHandler({
      arguments: { path: "/" },
      app,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/empty/i);
  });

  test("rejects when a file already exists at that path", async () => {
    setMockFile("note.md", "");
    const app = mockApp();
    const result = await createVaultDirectoryHandler({
      arguments: { path: "note.md" },
      app,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/file already exists/i);
  });
});
