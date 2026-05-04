import { describe, expect, test, beforeEach } from "bun:test";
import { listTagsHandler, listTagsSchema } from "./listTags";
import { mockApp, resetMockVault, setMockTags } from "$/test-setup";

beforeEach(() => resetMockVault());

describe("list_tags tool", () => {
  test("schema declares the tool name", () => {
    expect(listTagsSchema.get("name")?.toString()).toContain("list_tags");
  });

  test("returns empty result when vault has no tags", async () => {
    const r = await listTagsHandler({ arguments: {}, app: mockApp() });
    const data = JSON.parse(r.content[0].text as string);
    expect(data).toEqual({ totalTags: 0, tags: [] });
  });

  test("returns all tags with counts when vault has tags", async () => {
    setMockTags({ "#project": 5, "#daily": 12, "#idea": 1 });
    const r = await listTagsHandler({ arguments: {}, app: mockApp() });
    const data = JSON.parse(r.content[0].text as string);
    expect(data.totalTags).toBe(3);
    expect(data.tags).toHaveLength(3);
    expect(data.tags.map((t: { tag: string }) => t.tag).sort()).toEqual([
      "#daily",
      "#idea",
      "#project",
    ]);
  });

  test("default sort is by count descending", async () => {
    setMockTags({ "#a": 1, "#b": 10, "#c": 5 });
    const r = await listTagsHandler({ arguments: {}, app: mockApp() });
    const data = JSON.parse(r.content[0].text as string);
    expect(data.tags).toEqual([
      { tag: "#b", count: 10 },
      { tag: "#c", count: 5 },
      { tag: "#a", count: 1 },
    ]);
  });

  test("sort by name returns alphabetical order", async () => {
    setMockTags({ "#zebra": 1, "#apple": 100, "#mango": 5 });
    const r = await listTagsHandler({
      arguments: { sort: "name" },
      app: mockApp(),
    });
    const data = JSON.parse(r.content[0].text as string);
    expect(data.tags.map((t: { tag: string }) => t.tag)).toEqual([
      "#apple",
      "#mango",
      "#zebra",
    ]);
  });

  test("explicit sort by count matches default behaviour", async () => {
    setMockTags({ "#a": 3, "#b": 7 });
    const r = await listTagsHandler({
      arguments: { sort: "count" },
      app: mockApp(),
    });
    const data = JSON.parse(r.content[0].text as string);
    expect(data.tags[0]).toEqual({ tag: "#b", count: 7 });
    expect(data.tags[1]).toEqual({ tag: "#a", count: 3 });
  });

  test("preserves nested tag paths verbatim", async () => {
    setMockTags({
      "#project/active": 4,
      "#project/archived": 2,
      "#project": 1,
    });
    const r = await listTagsHandler({
      arguments: { sort: "name" },
      app: mockApp(),
    });
    const data = JSON.parse(r.content[0].text as string);
    expect(data.tags.map((t: { tag: string }) => t.tag)).toEqual([
      "#project",
      "#project/active",
      "#project/archived",
    ]);
  });
});
