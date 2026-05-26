import { describe, expect, test, beforeEach } from "bun:test";
import { getNoteOutlineHandler, getNoteOutlineSchema } from "./getNoteOutline";
import {
  mockApp,
  resetMockVault,
  setMockFile,
  setMockMetadata,
} from "$/test-setup";

beforeEach(() => resetMockVault());

describe("get_note_outline tool", () => {
  test("schema declares the tool name", () => {
    expect(getNoteOutlineSchema.get("name")?.toString()).toContain(
      "get_note_outline",
    );
  });

  test("returns ordered headings with 1-based line numbers", async () => {
    setMockFile("n.md", "");
    setMockMetadata("n.md", {
      headings: [
        { heading: "Introduction", level: 1, line: 0 },
        { heading: "Background", level: 2, line: 4 },
        { heading: "Details", level: 2, line: 9 },
      ],
    });
    const r = await getNoteOutlineHandler({
      arguments: { path: "n.md" },
      app: mockApp(),
    });
    const data = JSON.parse(r.content[0].text as string);
    expect(data.heading_count).toBe(3);
    expect(data.headings[0]).toEqual({
      level: 1,
      text: "Introduction",
      line_number: 1,
      anchor: "introduction",
    });
    expect(data.headings[1].line_number).toBe(5);
  });

  test("returns empty headings array for a note with no headings", async () => {
    setMockFile("n.md", "just body");
    setMockMetadata("n.md", {});
    const r = await getNoteOutlineHandler({
      arguments: { path: "n.md" },
      app: mockApp(),
    });
    const data = JSON.parse(r.content[0].text as string);
    expect(data.heading_count).toBe(0);
    expect(data.headings).toEqual([]);
    expect(r.isError).toBeUndefined();
  });

  test("errors with file_not_found for a missing path", async () => {
    const r = await getNoteOutlineHandler({
      arguments: { path: "ghost.md" },
      app: mockApp(),
    });
    expect(r.isError).toBe(true);
    expect(JSON.parse(r.content[0].text as string).errorCode).toBe(
      "file_not_found",
    );
  });

  test("anchor slug lowercases and hyphenates correctly", async () => {
    setMockFile("n.md", "");
    setMockMetadata("n.md", {
      headings: [{ heading: "Hello World 2026", level: 1, line: 0 }],
    });
    const r = await getNoteOutlineHandler({
      arguments: { path: "n.md" },
      app: mockApp(),
    });
    const data = JSON.parse(r.content[0].text as string);
    expect(data.headings[0].anchor).toBe("hello-world-2026");
  });

  test("anchor strips non-word characters", async () => {
    setMockFile("n.md", "");
    setMockMetadata("n.md", {
      headings: [{ heading: "C++ Basics!", level: 2, line: 0 }],
    });
    const r = await getNoteOutlineHandler({
      arguments: { path: "n.md" },
      app: mockApp(),
    });
    expect(JSON.parse(r.content[0].text as string).headings[0].anchor).toBe(
      "c-basics",
    );
  });

  test("produces correct anchor for non-ASCII heading", async () => {
    setMockFile("n.md", "");
    setMockMetadata("n.md", {
      headings: [{ heading: "Résumé", level: 2, line: 0 }],
    });
    const r = await getNoteOutlineHandler({
      arguments: { path: "n.md" },
      app: mockApp(),
    });
    expect(JSON.parse(r.content[0].text as string).headings[0].anchor).toBe(
      "résumé",
    );
  });

  test("returns empty result on no-cache file (safe skip)", async () => {
    setMockFile("n.md", "body");
    // No setMockMetadata → cache returns null → treat as 0 headings
    const r = await getNoteOutlineHandler({
      arguments: { path: "n.md" },
      app: mockApp(),
    });
    const data = JSON.parse(r.content[0].text as string);
    expect(data.heading_count).toBe(0);
    expect(r.isError).toBeUndefined();
  });
});
