import { describe, expect, test, beforeEach } from "bun:test";
import {
  findBrokenLinksHandler,
  findBrokenLinksSchema,
} from "./findBrokenLinks";
import {
  mockApp,
  resetMockVault,
  setMockFile,
  setMockMetadata,
} from "$/test-setup";

beforeEach(() => resetMockVault());

describe("find_broken_links tool", () => {
  test("schema declares the tool name", () => {
    expect(findBrokenLinksSchema.get("name")?.toString()).toContain(
      "find_broken_links",
    );
  });

  test("returns empty result on a vault with no broken links", async () => {
    setMockFile("a.md", "");
    setMockFile("b.md", "");
    setMockMetadata("a.md", { links: [{ link: "b", line: 2 }] });
    const r = await findBrokenLinksHandler({
      arguments: {},
      app: mockApp(),
    });
    const data = JSON.parse(r.content[0].text as string);
    expect(data.total_broken_links).toBe(0);
    expect(data.broken_links).toEqual([]);
  });

  test("detects a broken wiki-link", async () => {
    setMockFile("a.md", "");
    setMockMetadata("a.md", {
      links: [{ link: "NonExistent", original: "[[NonExistent]]", line: 3 }],
    });
    const r = await findBrokenLinksHandler({
      arguments: {},
      app: mockApp(),
    });
    const data = JSON.parse(r.content[0].text as string);
    expect(data.total_broken_links).toBe(1);
    const entry = data.broken_links[0];
    expect(entry.source_path).toBe("a.md");
    expect(entry.link_target).toBe("NonExistent");
    expect(entry.line_number).toBe(4); // 0-based line 3 → 1-based 4
    expect(entry.link_type).toBe("link");
    expect(entry.original).toBe("[[NonExistent]]");
  });

  test("detects a broken embed", async () => {
    setMockFile("a.md", "");
    setMockMetadata("a.md", {
      embeds: [{ link: "missing.png", original: "![[missing.png]]", line: 1 }],
    });
    const r = await findBrokenLinksHandler({ arguments: {}, app: mockApp() });
    const data = JSON.parse(r.content[0].text as string);
    expect(data.total_broken_links).toBe(1);
    expect(data.broken_links[0].link_type).toBe("embed");
  });

  test("detects a broken frontmatter link", async () => {
    setMockFile("a.md", "");
    setMockMetadata("a.md", {
      frontmatterLinks: [
        { link: "GhostNote", original: "[[GhostNote]]", key: "parent" },
      ],
    });
    const r = await findBrokenLinksHandler({ arguments: {}, app: mockApp() });
    const data = JSON.parse(r.content[0].text as string);
    expect(data.total_broken_links).toBe(1);
    expect(data.broken_links[0].link_type).toBe("frontmatter");
    expect(data.broken_links[0].line_number).toBe(0); // frontmatter sentinel
  });

  test("excludes files in default excluded folders", async () => {
    setMockFile("templates/my-template.md", "");
    setMockMetadata("templates/my-template.md", {
      links: [{ link: "BrokenFromTemplate", line: 1 }],
    });
    const r = await findBrokenLinksHandler({ arguments: {}, app: mockApp() });
    const data = JSON.parse(r.content[0].text as string);
    expect(data.total_broken_links).toBe(0);
    expect(data.excluded_folders).toContain("templates");
  });

  test("override exclude_folders replaces defaults entirely", async () => {
    setMockFile("templates/t.md", "");
    setMockMetadata("templates/t.md", {
      links: [{ link: "Broken", line: 1 }],
    });
    setMockFile("custom-exclude/n.md", "");
    setMockMetadata("custom-exclude/n.md", {
      links: [{ link: "AlsoBroken", line: 1 }],
    });
    // Override: only exclude custom-exclude, not templates
    const r = await findBrokenLinksHandler({
      arguments: { exclude_folders: ["custom-exclude"] },
      app: mockApp(),
    });
    const data = JSON.parse(r.content[0].text as string);
    // templates/t.md is now scanned → its broken link surfaces
    const sources = data.broken_links.map(
      (e: { source_path: string }) => e.source_path,
    );
    expect(sources).toContain("templates/t.md");
    expect(sources).not.toContain("custom-exclude/n.md");
  });

  test("reports scanned_files count", async () => {
    setMockFile("a.md", "");
    setMockFile("b.md", "");
    const r = await findBrokenLinksHandler({ arguments: {}, app: mockApp() });
    const data = JSON.parse(r.content[0].text as string);
    expect(data.scanned_files).toBe(2);
  });

  test("skips files with no metadata cache gracefully", async () => {
    setMockFile("no-cache.md", "[[BrokenLink]]");
    // no setMockMetadata → getFileCache returns null — file is skipped, not an error
    const r = await findBrokenLinksHandler({ arguments: {}, app: mockApp() });
    const data = JSON.parse(r.content[0].text as string);
    // scanned_files is incremented before the cache check — file counts as scanned
    expect(data.scanned_files).toBe(1);
    expect(data.total_broken_links).toBe(0);
    expect(r.isError).toBeUndefined();
  });
});
