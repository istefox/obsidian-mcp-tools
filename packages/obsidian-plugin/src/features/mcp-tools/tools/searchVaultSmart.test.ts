import { describe, expect, test, beforeEach } from "bun:test";
import {
  searchVaultSmartHandler,
  searchVaultSmartSchema,
} from "./searchVaultSmart";
import { mockApp, mockPlugin, resetMockVault } from "$/test-setup";

beforeEach(() => resetMockVault());

describe("search_vault_smart tool", () => {
  test("schema declares the tool name", () => {
    expect(searchVaultSmartSchema.get("name")?.toString()).toContain(
      "search_vault_smart",
    );
  });

  test("returns informative error when Smart Connections not loaded", async () => {
    const plugin = mockPlugin({
      smartSearch: undefined,
    } as never);

    const result = await searchVaultSmartHandler({
      arguments: { query: "machine learning notes" },
      app: mockApp(),
      plugin,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(
      /smart connections|not available|not installed/i,
    );
  });

  test("delegates query to Smart Connections API", async () => {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const fakeSmartSearch = {
      search: async (query: string, opts: unknown) => {
        calls.push({ method: "search", args: [query, opts] });
        return [
          {
            item: {
              path: "Notes/ml.md",
              breadcrumbs: "Notes > ml",
              read: async () => "machine learning content",
            },
            score: 0.9,
          },
          {
            item: {
              path: "Notes/ai.md",
              breadcrumbs: "Notes > ai",
              read: async () => "artificial intelligence content",
            },
            score: 0.8,
          },
        ];
      },
    };
    const plugin = mockPlugin({
      smartSearch: fakeSmartSearch,
    } as never);

    const result = await searchVaultSmartHandler({
      arguments: { query: "machine learning" },
      app: mockApp(),
      plugin,
    });
    expect(result.isError).toBeUndefined();
    expect(calls.length).toBe(1);
    expect(calls[0].args[0]).toBe("machine learning");
    const data = JSON.parse(result.content[0].text as string);
    expect(
      Array.isArray(data) || (data.results && Array.isArray(data.results)),
    ).toBe(true);
  });

  test("respects folder include/exclude filters and limit", async () => {
    const receivedOpts: unknown[] = [];
    const fakeSmartSearch = {
      search: async (
        _q: string,
        opts: {
          filter?: {
            exclude_key_starts_with_any?: string[];
            key_starts_with_any?: string[];
          };
          limit?: number;
        },
      ) => {
        receivedOpts.push(opts);
        // Verify opts received
        expect(opts).toBeDefined();
        return [];
      },
    };
    const plugin = mockPlugin({
      smartSearch: fakeSmartSearch,
    } as never);

    const result = await searchVaultSmartHandler({
      arguments: {
        query: "x",
        filter: {
          excludeFolders: ["Archive"],
          includeFolders: ["Notes"],
        },
        limit: 5,
      },
      app: mockApp(),
      plugin,
    });
    expect(result.isError).toBeUndefined();

    // Verify that filters and limit were forwarded to the API
    const opts = receivedOpts[0] as Record<string, unknown>;
    expect(opts.key_starts_with_any).toEqual(["Notes"]);
    expect(opts.exclude_key_starts_with_any).toEqual(["Archive"]);
    expect(opts.limit).toBe(5);
  });

  test("returns results with path, score, breadcrumbs, and text", async () => {
    const fakeSmartSearch = {
      search: async () => [
        {
          item: {
            path: "Zettelkasten/idea.md",
            breadcrumbs: "Zettelkasten > idea",
            read: async () => "The idea content",
          },
          score: 0.95,
        },
      ],
    };
    const plugin = mockPlugin({
      smartSearch: fakeSmartSearch,
    } as never);

    const result = await searchVaultSmartHandler({
      arguments: { query: "idea" },
      app: mockApp(),
      plugin,
    });
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text as string);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].path).toBe("Zettelkasten/idea.md");
    expect(data.results[0].score).toBe(0.95);
    expect(data.results[0].text).toBe("The idea content");
    expect(data.results[0].breadcrumbs).toBe("Zettelkasten > idea");
  });
});
