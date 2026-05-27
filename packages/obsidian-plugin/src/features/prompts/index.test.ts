import { describe, expect, test, beforeEach } from "bun:test";
import {
  mockApp,
  resetMockVault,
  setMockFile,
  setMockMetadata,
} from "$/test-setup";
import { PromptRegistryClass } from "$/features/mcp-transport/services/promptRegistry";
import { setup, teardown } from "./index";

beforeEach(() => {
  resetMockVault();
});

describe("prompts feature setup", () => {
  test("returns success with watcher state", async () => {
    const registry = new PromptRegistryClass();
    const app = mockApp();
    const result = await setup(registry, app);
    expect(result.success).toBe(true);
    if (result.success) teardown(result.state);
  });

  test("registry.list() returns discovered prompts", async () => {
    setMockFile(
      "Prompts/greet.md",
      `<% tp.mcpTools.prompt("who", "Target") %>\nHello {{who}}`,
    );
    setMockMetadata("Prompts/greet.md", {
      frontmatter: { tags: ["mcp-tools-prompt"], description: "A greeting" },
    });

    const registry = new PromptRegistryClass();
    const app = mockApp();
    const result = await setup(registry, app);
    expect(result.success).toBe(true);

    const list = await registry.list();
    expect(list.prompts).toHaveLength(1);
    expect(list.prompts[0].name).toBe("greet");
    expect(list.prompts[0].description).toBe("A greeting");
    expect(list.prompts[0].arguments[0].name).toBe("who");

    if (result.success) teardown(result.state);
  });

  test("registry.dispatch() returns rendered message for known prompt", async () => {
    const content = [
      "---",
      "tags: [mcp-tools-prompt]",
      "---",
      "",
      `<% tp.mcpTools.prompt("who", "Target") %>`,
      "",
      "Hello {{who}}!",
    ].join("\n");
    setMockFile("Prompts/greet.md", content);
    setMockMetadata("Prompts/greet.md", {
      frontmatter: { tags: ["mcp-tools-prompt"] },
    });

    const registry = new PromptRegistryClass();
    const app = mockApp();
    const result = await setup(registry, app);
    expect(result.success).toBe(true);

    const dispatchResult = await registry.dispatch({
      name: "greet",
      arguments: { who: "World" },
    });
    expect(dispatchResult.messages[0].role).toBe("user");
    expect(dispatchResult.messages[0].content.text).toContain("Hello World!");

    if (result.success) teardown(result.state);
  });

  test("registry.dispatch() throws InvalidParams for unknown prompt", async () => {
    const registry = new PromptRegistryClass();
    const app = mockApp();
    const result = await setup(registry, app);
    expect(result.success).toBe(true);

    await expect(
      registry.dispatch({ name: "nonexistent" }),
    ).rejects.toMatchObject({ code: expect.any(Number) });

    if (result.success) teardown(result.state);
  });

  test("teardown stops the vault watcher", async () => {
    const registry = new PromptRegistryClass();
    const app = mockApp();
    const result = await setup(registry, app);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(() => teardown(result.state)).not.toThrow();
    }
  });
});
