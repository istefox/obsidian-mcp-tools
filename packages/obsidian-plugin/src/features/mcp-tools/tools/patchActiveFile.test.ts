import { describe, expect, test, beforeEach } from "bun:test";
import { patchActiveFileHandler, patchActiveFileSchema } from "./patchActiveFile";
import {
  mockApp,
  resetMockVault,
  setMockActiveFile,
  setMockFile,
  setMockMetadata,
} from "$/test-setup";

beforeEach(() => resetMockVault());

describe("patch_active_file tool", () => {
  test("schema declares the tool name", () => {
    expect(patchActiveFileSchema.get("name")?.toString()).toContain("patch_active_file");
  });

  test("inserts content under matching heading (append + heading)", async () => {
    setMockFile("a.md", "# Top\n\n## Section A\n\noldA\n\n## Section B\n\noldB\n");
    setMockActiveFile("a.md");
    const app = mockApp();

    const result = await patchActiveFileHandler({
      arguments: {
        operation: "append",
        targetType: "heading",
        target: "Section A",
        content: "newA",
      },
      app,
    });
    expect(result.isError).toBeUndefined();
    const file = app.workspace.getActiveFile()!;
    const final = await app.vault.read(file);
    expect(final).toContain("oldA");
    expect(final).toContain("newA");
    // newA appears in Section A region, before Section B
    expect(final.indexOf("newA")).toBeLessThan(final.indexOf("Section B"));
  });

  test("replaces block reference content (replace + block)", async () => {
    setMockFile("a.md", "Para 1\n\nPara 2\n^abc\n\nPara 3\n");
    setMockActiveFile("a.md");
    setMockMetadata("a.md", {
      blocks: { abc: { startLine: 2, endLine: 3 } }, // line of "Para 2" + "^abc"
    });
    const app = mockApp();

    const result = await patchActiveFileHandler({
      arguments: {
        operation: "replace",
        targetType: "block",
        target: "abc",
        content: "Replaced para",
      },
      app,
    });
    expect(result.isError).toBeUndefined();
    const file = app.workspace.getActiveFile()!;
    const final = await app.vault.read(file);
    expect(final).toContain("Replaced para");
    expect(final).not.toContain("Para 2");
  });

  test("updates frontmatter field (replace + frontmatter)", async () => {
    setMockFile("a.md", "---\nstatus: draft\n---\n# Body");
    setMockActiveFile("a.md");
    setMockMetadata("a.md", { frontmatter: { status: "draft" } });
    const app = mockApp();

    const result = await patchActiveFileHandler({
      arguments: {
        operation: "replace",
        targetType: "frontmatter",
        target: "status",
        content: "published",
      },
      app,
    });
    expect(result.isError).toBeUndefined();
    const cache = app.metadataCache.getFileCache(app.workspace.getActiveFile()!);
    expect(cache?.frontmatter?.status).toBe("published");
  });

  test("block target with createTargetIfMissing=false fails loud on miss", async () => {
    setMockFile("a.md", "Just text, no blocks\n");
    setMockActiveFile("a.md");
    setMockMetadata("a.md", { blocks: {} });
    const app = mockApp();

    const result = await patchActiveFileHandler({
      arguments: {
        operation: "append",
        targetType: "block",
        target: "missingId",
        content: "X",
      },
      app,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/block.*not found|unresolved/i);
  });

  test("heading target with default createTargetIfMissing=true appends at EOF on miss", async () => {
    setMockFile("a.md", "# Top\n\nbody\n");
    setMockActiveFile("a.md");
    const app = mockApp();

    const result = await patchActiveFileHandler({
      arguments: {
        operation: "append",
        targetType: "heading",
        target: "MissingHeading",
        content: "Tail content",
      },
      app,
    });
    expect(result.isError).toBeUndefined();
    const file = app.workspace.getActiveFile()!;
    const final = await app.vault.read(file);
    expect(final).toContain("Tail content");
  });

  // ── Frontmatter regression coverage (issues #12, #13) ─────────────────

  test("issue #12: replace on array-valued frontmatter with scalar content → typed reject, file untouched", async () => {
    setMockFile("a.md", "---\ntags:\n  - alpha\n  - beta\n---\nbody\n");
    setMockActiveFile("a.md");
    setMockMetadata("a.md", { frontmatter: { tags: ["alpha", "beta"] } });
    const app = mockApp();

    const result = await patchActiveFileHandler({
      arguments: {
        operation: "replace",
        targetType: "frontmatter",
        target: "tags",
        content: "gamma",
      },
      app,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/array/i);
    const cache = app.metadataCache.getFileCache(app.workspace.getActiveFile()!);
    expect(cache?.frontmatter?.tags).toEqual(["alpha", "beta"]);
  });

  test("issue #13: append on array-valued frontmatter with JSON scalar pushes parsed scalar", async () => {
    setMockFile("a.md", "---\ntags:\n  - existing\n---\n");
    setMockActiveFile("a.md");
    setMockMetadata("a.md", { frontmatter: { tags: ["existing"] } });
    const app = mockApp();

    const result = await patchActiveFileHandler({
      arguments: {
        operation: "append",
        targetType: "frontmatter",
        target: "tags",
        content: '"new-tag"',
      },
      app,
    });
    expect(result.isError).toBeUndefined();
    const cache = app.metadataCache.getFileCache(app.workspace.getActiveFile()!);
    expect(cache?.frontmatter?.tags).toEqual(["existing", "new-tag"]);
  });

  test("issue #13: append on array-valued frontmatter with plain string pushes as element", async () => {
    setMockFile("a.md", "---\ntags:\n  - existing\n---\n");
    setMockActiveFile("a.md");
    setMockMetadata("a.md", { frontmatter: { tags: ["existing"] } });
    const app = mockApp();

    const result = await patchActiveFileHandler({
      arguments: {
        operation: "append",
        targetType: "frontmatter",
        target: "tags",
        content: "new-tag",
      },
      app,
    });
    expect(result.isError).toBeUndefined();
    const cache = app.metadataCache.getFileCache(app.workspace.getActiveFile()!);
    expect(cache?.frontmatter?.tags).toEqual(["existing", "new-tag"]);
  });

  test("issue #76: heading replace emits leading + trailing blank lines (input has leading blank)", async () => {
    setMockFile("a.md", "## A\n\nold\n\n## B\n");
    setMockActiveFile("a.md");
    const app = mockApp();

    const result = await patchActiveFileHandler({
      arguments: {
        operation: "replace",
        targetType: "heading",
        target: "A",
        content: "new",
      },
      app,
    });
    expect(result.isError).toBeUndefined();
    const file = app.workspace.getActiveFile()!;
    const final = await app.vault.read(file);
    // Both leading and trailing blank lines preserved.
    expect(final).toContain("## A\n\nnew\n\n## B");
  });

  test("issue #76: heading replace emits leading blank even when input has none (Linter-correct shape)", async () => {
    setMockFile("a.md", "## A\nold\n\n## B\n");
    setMockActiveFile("a.md");
    const app = mockApp();

    const result = await patchActiveFileHandler({
      arguments: {
        operation: "replace",
        targetType: "heading",
        target: "A",
        content: "new",
      },
      app,
    });
    expect(result.isError).toBeUndefined();
    const file = app.workspace.getActiveFile()!;
    const final = await app.vault.read(file);
    // Symmetric with the trailing-separator fix: replace normalises
    // regardless of input shape.
    expect(final).toContain("## A\n\nnew\n\n## B");
  });

  test("issue #76: heading replace does NOT double-emit when content already starts with blank", async () => {
    setMockFile("a.md", "## A\n\nold\n\n## B\n");
    setMockActiveFile("a.md");
    const app = mockApp();

    const result = await patchActiveFileHandler({
      arguments: {
        operation: "replace",
        targetType: "heading",
        target: "A",
        content: "\nnew",
      },
      app,
    });
    expect(result.isError).toBeUndefined();
    const file = app.workspace.getActiveFile()!;
    const final = await app.vault.read(file);
    // Caller-supplied leading newline is respected.
    expect(final).toContain("## A\n\nnew\n\n## B");
    expect(final).not.toContain("## A\n\n\nnew");
  });

  test("returns error when no active file", async () => {
    setMockActiveFile(null);
    const result = await patchActiveFileHandler({
      arguments: {
        operation: "append",
        targetType: "heading",
        target: "X",
        content: "Y",
      },
      app: mockApp(),
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/no active file/i);
  });
});
