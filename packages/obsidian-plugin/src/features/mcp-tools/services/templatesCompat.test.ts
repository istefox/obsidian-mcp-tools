import { describe, expect, test, beforeEach } from "bun:test";
import { handleTemplatesExecuteCompat } from "./templatesCompat";
import { mockApp, mockPlugin, resetMockVault, setMockFile } from "$/test-setup";

beforeEach(() => resetMockVault());

// ---------------------------------------------------------------------------
// Helpers — mirrors `executeTemplate.test.ts`. Kept local instead of shared
// because the helper is small and the test surface is different (LRA shape
// vs in-process tool shape).
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

function mockPluginWithTemplater(
  fakeTemplater: ReturnType<typeof makeFakeTemplater> | undefined,
) {
  const app = mockApp();
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

describe("templatesCompat — handleTemplatesExecuteCompat", () => {
  test("returns 400 on invalid request body (missing required `name`)", async () => {
    const plugin = mockPluginWithTemplater(makeFakeTemplater());

    const result = await handleTemplatesExecuteCompat(plugin, {
      // `name` missing — schema requires it
      arguments: { foo: "bar" },
    });

    expect(result.status).toBe(400);
    if (result.status === 400) {
      expect(result.payload.error).toBe("Invalid request body");
      expect(result.payload.summary).toBeDefined();
    }
  });

  test("returns 400 on completely malformed body", async () => {
    const plugin = mockPluginWithTemplater(makeFakeTemplater());

    const result = await handleTemplatesExecuteCompat(plugin, "not an object");

    expect(result.status).toBe(400);
  });

  test("returns 503 when Templater plugin is not installed", async () => {
    const plugin = mockPluginWithTemplater(undefined);

    const result = await handleTemplatesExecuteCompat(plugin, {
      name: "Templates/foo.md",
      arguments: {},
    });

    expect(result.status).toBe(503);
    if (result.status === 503) {
      expect(result.payload.error).toMatch(/templater.*not installed/i);
    }
  });

  test("returns 404 when template file does not exist in vault", async () => {
    const plugin = mockPluginWithTemplater(makeFakeTemplater());

    const result = await handleTemplatesExecuteCompat(plugin, {
      name: "Templates/does-not-exist.md",
      arguments: {},
    });

    expect(result.status).toBe(404);
    if (result.status === 404) {
      expect(result.payload.error).toContain("Templates/does-not-exist.md");
    }
  });

  test("returns 200 with rendered content when createFile is omitted", async () => {
    setMockFile("Templates/foo.md", "Hello {{name}}");
    const fakeTemplater = makeFakeTemplater("Hello World");
    const plugin = mockPluginWithTemplater(fakeTemplater);

    const result = await handleTemplatesExecuteCompat(plugin, {
      name: "Templates/foo.md",
      arguments: { name: "World" },
    });

    expect(result.status).toBe(200);
    if (result.status === 200) {
      expect(result.payload.content).toBe("Hello World");
      expect(result.payload.message).toMatch(/without creating/i);
      // `path` should NOT be present when createFile is omitted/false
      expect(result.payload.path).toBeUndefined();
    }
  });

  test("returns 200 with rendered content when createFile=false explicitly", async () => {
    setMockFile("Templates/foo.md", "Hello");
    const plugin = mockPluginWithTemplater(makeFakeTemplater("Hello"));

    const result = await handleTemplatesExecuteCompat(plugin, {
      name: "Templates/foo.md",
      arguments: {},
      createFile: false,
    });

    expect(result.status).toBe(200);
    if (result.status === 200) {
      expect(result.payload.content).toBe("Hello");
      expect(result.payload.path).toBeUndefined();
    }
  });

  test("returns 200 with `path` when createFile=true and targetPath is provided", async () => {
    setMockFile("Templates/foo.md", "Hello");
    const plugin = mockPluginWithTemplater(makeFakeTemplater("Hello rendered"));

    const result = await handleTemplatesExecuteCompat(plugin, {
      name: "Templates/foo.md",
      arguments: {},
      createFile: true,
      targetPath: "Notes/output.md",
    });

    expect(result.status).toBe(200);
    if (result.status === 200) {
      expect(result.payload.content).toBe("Hello rendered");
      expect(result.payload.message).toMatch(/created/i);
      expect(result.payload.path).toBe("Notes/output.md");
    }
  });

  test("maps boolean createFile (LRA shape) to string '\"true\"' (in-process tool shape) — file is created", async () => {
    setMockFile("Templates/foo.md", "Hello");
    const fakeTemplater = makeFakeTemplater("Hello rendered");
    const plugin = mockPluginWithTemplater(fakeTemplater);

    const result = await handleTemplatesExecuteCompat(plugin, {
      name: "Templates/foo.md",
      arguments: {},
      createFile: true,
      targetPath: "Notes/output.md",
    });

    // The vault.create call would have been made by executeTemplateHandler
    // — verified indirectly by the success status + path echo. The
    // mapping itself is what we care about: a boolean `true` from the
    // LRA shape must produce `path` in the response (which only
    // happens on the createFile branch of the in-process handler).
    expect(result.status).toBe(200);
    if (result.status === 200) {
      expect(result.payload.path).toBe("Notes/output.md");
    }
  });

  test("forwards arguments map to the template prompt accessor", async () => {
    setMockFile("Templates/foo.md", "Hello");
    const fakeTemplater = makeFakeTemplater("Hello rendered");
    const plugin = mockPluginWithTemplater(fakeTemplater);

    const result = await handleTemplatesExecuteCompat(plugin, {
      name: "Templates/foo.md",
      arguments: { greeting: "ciao", name: "Stefano" },
    });

    // The arguments path is exercised by the in-process handler's
    // generate_object override; here we just ensure the call succeeds
    // and the templater's read_and_parse_template was invoked.
    expect(result.status).toBe(200);
    expect(fakeTemplater._calls).toHaveLength(1);
  });

  test("returns 500 when the template execution itself throws", async () => {
    setMockFile("Templates/foo.md", "Hello");
    const failingTemplater = makeFakeTemplater();
    failingTemplater.read_and_parse_template = async () => {
      throw new Error("Templater rendering exploded mid-flight");
    };
    const plugin = mockPluginWithTemplater(failingTemplater);

    const result = await handleTemplatesExecuteCompat(plugin, {
      name: "Templates/foo.md",
      arguments: {},
    });

    expect(result.status).toBe(500);
    if (result.status === 500) {
      expect(result.payload.error).toContain(
        "Templater rendering exploded mid-flight",
      );
    }
  });
});
