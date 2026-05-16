import { describe, expect, test, beforeEach } from "bun:test";
import {
  executeTemplateHandler,
  executeTemplateSchema,
} from "./executeTemplate";
import { mockApp, mockPlugin, resetMockVault, setMockFile } from "$/test-setup";

beforeEach(() => resetMockVault());

// ---------------------------------------------------------------------------
// Helpers — build a minimal fake Templater ITemplater API that records calls
// ---------------------------------------------------------------------------

type FakeTemplaterCall = {
  method: string;
  templatePath: string;
  processedContent: string;
};

function makeFakeTemplater(renderedContent = "RENDERED") {
  const calls: FakeTemplaterCall[] = [];

  const fakeTemplater = {
    _calls: calls,
    functions_generator: {
      generate_object: async (
        _config: unknown,
        _mode: unknown,
      ): Promise<Record<string, unknown>> => {
        return {};
      },
    },
    create_running_config: (
      templateFile: unknown,
      _targetFile: unknown,
      _runMode: unknown,
    ) => {
      return { template_file: templateFile, target_file: templateFile };
    },
    read_and_parse_template: async (config: {
      template_file: { path: string };
    }) => {
      calls.push({
        method: "read_and_parse_template",
        templatePath: config.template_file.path,
        processedContent: renderedContent,
      });
      return renderedContent;
    },
  };

  return fakeTemplater;
}

// Build a mockPlugin with a fake Templater plugin wired in via
// app.plugins.plugins["templater-obsidian"].templater
function mockPluginWithTemplater(
  fakeTemplater: ReturnType<typeof makeFakeTemplater> | undefined,
) {
  const app = mockApp();
  // Wire the fake templater into the app's plugins registry
  (
    app as unknown as {
      plugins: {
        plugins: Record<string, { templater?: unknown }>;
      };
    }
  ).plugins = {
    plugins: {
      "templater-obsidian": fakeTemplater ? { templater: fakeTemplater } : {},
    },
  };

  return mockPlugin({ app } as never);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("execute_template tool", () => {
  test("schema declares the tool name", () => {
    expect(executeTemplateSchema.get("name")?.toString()).toContain(
      "execute_template",
    );
  });

  test("returns error when Templater plugin not available", async () => {
    const plugin = mockPluginWithTemplater(undefined);

    const result = await executeTemplateHandler({
      arguments: { templatePath: "Templates/foo.md" },
      app: plugin.app,
      plugin,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/templater|not available|not installed/i);
  });

  test("returns error when template file not found in vault", async () => {
    // No file registered in the mock vault — getAbstractFileByPath returns null
    const fakeTemplater = makeFakeTemplater();
    const plugin = mockPluginWithTemplater(fakeTemplater);

    const result = await executeTemplateHandler({
      arguments: { templatePath: "Templates/missing.md" },
      app: plugin.app,
      plugin,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Templates/missing.md");
  });

  test("renders template and returns content without creating a file", async () => {
    setMockFile("Templates/foo.md", "Hello {{name}}");

    const fakeTemplater = makeFakeTemplater("Hello World");
    const plugin = mockPluginWithTemplater(fakeTemplater);

    const result = await executeTemplateHandler({
      arguments: {
        templatePath: "Templates/foo.md",
        arguments: { name: "World" },
      },
      app: plugin.app,
      plugin,
    });

    expect(result.isError).toBeUndefined();
    expect(fakeTemplater._calls).toHaveLength(1);
    expect(fakeTemplater._calls[0].method).toBe("read_and_parse_template");

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.content).toBe("Hello World");
    expect(parsed.message).toMatch(/without creating/i);
  });

  test("executes template and creates target file when createFile='true' and targetPath specified", async () => {
    setMockFile("Templates/foo.md", "Hello {{name}}");

    const fakeTemplater = makeFakeTemplater("RENDERED_CONTENT");
    const plugin = mockPluginWithTemplater(fakeTemplater);

    const result = await executeTemplateHandler({
      arguments: {
        templatePath: "Templates/foo.md",
        targetPath: "Output/note.md",
        createFile: "true",
      },
      app: plugin.app,
      plugin,
    });

    expect(result.isError).toBeUndefined();
    expect(fakeTemplater._calls).toHaveLength(1);

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.content).toBe("RENDERED_CONTENT");
    expect(parsed.message).toMatch(/created successfully/i);
    // Issue #20: createFile success response includes the targetPath.
    expect(parsed.path).toBe("Output/note.md");

    // Verify the file was actually created in the mock vault
    const createdFile = plugin.app.vault.getAbstractFileByPath("Output/note.md");
    expect(createdFile).not.toBeNull();
  });

  test("does NOT create a file when createFile is omitted", async () => {
    setMockFile("a.md", "X");
    const fakeTemplater = makeFakeTemplater("RENDERED");
    const plugin = mockPluginWithTemplater(fakeTemplater);

    const result = await executeTemplateHandler({
      arguments: { templatePath: "a.md", targetPath: "Output/out.md" },
      app: plugin.app,
      plugin,
    });

    expect(result.isError).toBeUndefined();
    // createFile was not "true" — file should NOT be created
    const file = plugin.app.vault.getAbstractFileByPath("Output/out.md");
    expect(file).toBeNull();
  });

  test("createFile coercion accepts string 'true'", async () => {
    setMockFile("a.md", "X");
    const fakeTemplater = makeFakeTemplater("RENDERED");
    const plugin = mockPluginWithTemplater(fakeTemplater);

    const result = await executeTemplateHandler({
      arguments: {
        templatePath: "a.md",
        targetPath: "out.md",
        createFile: "true",
      },
      app: plugin.app,
      plugin,
    });

    expect(result.isError).toBeUndefined();
    const file = plugin.app.vault.getAbstractFileByPath("out.md");
    expect(file).not.toBeNull();
  });

  test("createFile='false' does not create file even with targetPath", async () => {
    setMockFile("a.md", "X");
    const fakeTemplater = makeFakeTemplater("RENDERED");
    const plugin = mockPluginWithTemplater(fakeTemplater);

    const result = await executeTemplateHandler({
      arguments: {
        templatePath: "a.md",
        targetPath: "out.md",
        createFile: "false",
      },
      app: plugin.app,
      plugin,
    });

    expect(result.isError).toBeUndefined();
    const file = plugin.app.vault.getAbstractFileByPath("out.md");
    expect(file).toBeNull();
  });

  test("restores generate_object after successful execution (not the injecting override)", async () => {
    setMockFile("a.md", "X");
    const fakeTemplater = makeFakeTemplater("RENDERED");
    const plugin = mockPluginWithTemplater(fakeTemplater);

    await executeTemplateHandler({
      arguments: { templatePath: "a.md" },
      app: plugin.app,
      plugin,
    });

    // After execution, the current generate_object must NOT be the injecting
    // override — it does not produce an `mcpTools` property in its output.
    // We verify by calling it and checking there is no `mcpTools` key.
    const result = await fakeTemplater.functions_generator.generate_object(
      {} as never,
      undefined,
    );
    expect((result as Record<string, unknown>).mcpTools).toBeUndefined();
  });

  test("issue #19: read_and_parse_template error surfaces as isError result with verbatim message (no double prefix)", async () => {
    setMockFile("a.md", "X");
    const fakeTemplater = makeFakeTemplater("RENDERED");
    fakeTemplater.read_and_parse_template = async () => {
      throw new Error("Templater internal error");
    };
    const plugin = mockPluginWithTemplater(fakeTemplater);

    const result = await executeTemplateHandler({
      arguments: { templatePath: "a.md" },
      app: plugin.app,
      plugin,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Templater internal error");
    // The handler must NOT wrap the message in `MCP error -<code>:` itself —
    // the registry would then wrap again, producing the double prefix folotp
    // reported.
    expect(result.content[0].text).not.toMatch(/MCP error -?\d+:.*MCP error/);

    // generate_object must be restored to the non-injecting version
    const restored = await fakeTemplater.functions_generator.generate_object(
      {} as never,
      undefined,
    );
    expect((restored as Record<string, unknown>).mcpTools).toBeUndefined();
  });
});
