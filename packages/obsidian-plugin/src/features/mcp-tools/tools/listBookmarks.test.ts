import { describe, expect, test, beforeEach } from "bun:test";
import { listBookmarksHandler, listBookmarksSchema } from "./listBookmarks";
import { mockApp, resetMockVault, setMockBookmarksState } from "$/test-setup";

beforeEach(() => resetMockVault());

describe("list_bookmarks tool", () => {
  test("schema declares the tool name", () => {
    expect(listBookmarksSchema.get("name")?.toString()).toContain(
      "list_bookmarks",
    );
  });

  test("returns enabled:false when bookmarks plugin is disabled", async () => {
    // default mock state: disabled
    const r = await listBookmarksHandler({
      arguments: {},
      app: mockApp(),
    });
    const data = JSON.parse(r.content[0].text as string);
    expect(data.enabled).toBe(false);
    expect(data.total_items).toBe(0);
    expect(data.items).toEqual([]);
  });

  test("returns file bookmarks when plugin is enabled", async () => {
    setMockBookmarksState({
      enabled: true,
      items: [
        { type: "file", path: "Projects/roadmap.md", title: "Roadmap" },
        { type: "file", path: "index.md" },
      ],
    });
    const r = await listBookmarksHandler({ arguments: {}, app: mockApp() });
    const data = JSON.parse(r.content[0].text as string);
    expect(data.enabled).toBe(true);
    expect(data.total_items).toBe(2);
    expect(data.items[0].path).toBe("Projects/roadmap.md");
  });

  test("returns nested group structure", async () => {
    setMockBookmarksState({
      enabled: true,
      items: [
        {
          type: "group",
          title: "Work",
          items: [
            { type: "file", path: "work/todo.md" },
            { type: "search", query: "status:active" },
          ],
        },
      ],
    });
    const r = await listBookmarksHandler({ arguments: {}, app: mockApp() });
    const data = JSON.parse(r.content[0].text as string);
    expect(data.total_items).toBe(2); // only non-group items counted
    expect(data.items[0].type).toBe("group");
    expect(data.items[0].items.length).toBe(2);
  });

  test("include_types filter excludes non-matching items", async () => {
    setMockBookmarksState({
      enabled: true,
      items: [
        { type: "file", path: "a.md" },
        { type: "search", query: "foo" },
        { type: "folder", path: "Projects" },
      ],
    });
    const r = await listBookmarksHandler({
      arguments: { include_types: ["file"] },
      app: mockApp(),
    });
    const data = JSON.parse(r.content[0].text as string);
    expect(data.total_items).toBe(1);
    expect(data.items.every((i: { type: string }) => i.type === "file")).toBe(
      true,
    );
  });

  test("empty bookmarks list returns total_items: 0", async () => {
    setMockBookmarksState({ enabled: true, items: [] });
    const r = await listBookmarksHandler({ arguments: {}, app: mockApp() });
    const data = JSON.parse(r.content[0].text as string);
    expect(data.enabled).toBe(true);
    expect(data.total_items).toBe(0);
  });

  test("group without items returns empty items array", async () => {
    setMockBookmarksState({
      enabled: true,
      items: [{ type: "group", title: "EmptyGroup", items: [] }],
    });
    const r = await listBookmarksHandler({ arguments: {}, app: mockApp() });
    const data = JSON.parse(r.content[0].text as string);
    expect(data.items[0]).toEqual({
      type: "group",
      title: "EmptyGroup",
      items: [],
    });
  });

  test('include_types:["group"] preserves group nodes and filters non-group children', async () => {
    setMockBookmarksState({
      enabled: true,
      items: [
        {
          type: "group",
          title: "Work",
          items: [
            { type: "file", path: "work/todo.md" },
            { type: "search", query: "status:active" },
          ],
        },
        { type: "file", path: "standalone.md" },
      ],
    });
    const r = await listBookmarksHandler({
      arguments: { include_types: ["group"] },
      app: mockApp(),
    });
    const data = JSON.parse(r.content[0].text as string);
    // Only the group node is preserved; the standalone file and children are filtered
    expect(data.items.length).toBe(1);
    expect(data.items[0].type).toBe("group");
    // group children are filtered to only those matching include_types (group) — none match → empty
    expect(data.items[0].items).toEqual([]);
    expect(data.total_items).toBe(0);
  });
});
