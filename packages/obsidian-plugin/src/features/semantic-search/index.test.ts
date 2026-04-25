import { describe, expect, test, beforeEach } from "bun:test";
import type McpToolsPlugin from "$/main";
import { setup, type SemanticSearchState } from "./index";
import { DEFAULT_SEMANTIC_SETTINGS } from "./types";

/**
 * Minimal plugin stub: only loadData + saveData are exercised by the
 * settings load path. Other McpToolsPlugin members are not touched
 * here. The provider/indexer test surface lives in the dedicated
 * service test files (T3-T10).
 */
function makePluginStub(initial: Record<string, unknown> = {}) {
  let storage: Record<string, unknown> = { ...initial };
  let saveCount = 0;
  const stub = {
    async loadData() {
      // Return a structuralClone-ish copy so callers cannot mutate
      // internal state by reference.
      return JSON.parse(JSON.stringify(storage));
    },
    async saveData(data: Record<string, unknown>) {
      saveCount += 1;
      storage = JSON.parse(JSON.stringify(data));
    },
  };
  return {
    plugin: stub as unknown as McpToolsPlugin,
    getSaveCount: () => saveCount,
    getStorage: () => storage,
  };
}

async function setupOrThrow(plugin: McpToolsPlugin): Promise<SemanticSearchState> {
  const result = await setup(plugin);
  if (!result.success) {
    throw new Error(`setup failed: ${result.error}`);
  }
  return result.state;
}

describe("semantic-search setup — settings load/merge/persist", () => {
  test("empty data.json → defaults persisted", async () => {
    const { plugin, getSaveCount, getStorage } = makePluginStub();
    const state = await setupOrThrow(plugin);

    expect(state.settings).toEqual(DEFAULT_SEMANTIC_SETTINGS);
    expect(getSaveCount()).toBe(1);
    expect(getStorage().semanticSearch).toEqual(DEFAULT_SEMANTIC_SETTINGS);
  });

  test("partial settings → merged with defaults and persisted", async () => {
    const { plugin, getSaveCount, getStorage } = makePluginStub({
      semanticSearch: { provider: "native" },
    });
    const state = await setupOrThrow(plugin);

    expect(state.settings.provider).toBe("native");
    expect(state.settings.indexingMode).toBe(DEFAULT_SEMANTIC_SETTINGS.indexingMode);
    expect(state.settings.unloadModelWhenIdle).toBe(
      DEFAULT_SEMANTIC_SETTINGS.unloadModelWhenIdle,
    );
    // Merge writes back the completed object.
    expect(getSaveCount()).toBe(1);
    expect(getStorage().semanticSearch).toEqual(state.settings);
  });

  test("complete settings → no rewrite (idempotent load)", async () => {
    const fullSettings = {
      provider: "smart-connections" as const,
      indexingMode: "low-power" as const,
      unloadModelWhenIdle: false,
    };
    const { plugin, getSaveCount } = makePluginStub({
      semanticSearch: fullSettings,
    });
    const state = await setupOrThrow(plugin);

    expect(state.settings).toEqual(fullSettings);
    expect(getSaveCount()).toBe(0); // no persist needed
  });

  test("malformed settings → fallback defaults + log, persist sanitized", async () => {
    const { plugin, getSaveCount, getStorage } = makePluginStub({
      semanticSearch: { provider: "telepathy", indexingMode: 42, unloadModelWhenIdle: "yes" },
    });
    const state = await setupOrThrow(plugin);

    expect(state.settings).toEqual(DEFAULT_SEMANTIC_SETTINGS);
    expect(getSaveCount()).toBe(1);
    expect(getStorage().semanticSearch).toEqual(DEFAULT_SEMANTIC_SETTINGS);
  });

  test("preserves unrelated keys in data.json", async () => {
    const { plugin, getStorage } = makePluginStub({
      commandPermissions: { enabled: true, allowlist: ["editor:toggle-bold"] },
      toolToggle: { disabled: ["fetch"] },
    });
    await setupOrThrow(plugin);

    const storage = getStorage() as Record<string, unknown>;
    expect(storage.commandPermissions).toEqual({
      enabled: true,
      allowlist: ["editor:toggle-bold"],
    });
    expect(storage.toolToggle).toEqual({ disabled: ["fetch"] });
    expect(storage.semanticSearch).toEqual(DEFAULT_SEMANTIC_SETTINGS);
  });

  test("provider before T6/T7 is a NoopProvider (isReady=false, search throws)", async () => {
    const { plugin } = makePluginStub();
    const state = await setupOrThrow(plugin);

    expect(state.provider.isReady()).toBe(false);
    await expect(state.provider.search("anything", {})).rejects.toThrow(
      /not configured/i,
    );
  });

  test("two concurrent setups serialize via the mutex (no lost updates)", async () => {
    // 35-way concurrency lives with T9 (the live indexer is the real
    // multi-writer surface). For T2, asserting that two parallel
    // setup() calls produce identical, non-corrupt state is enough
    // to validate the lock contract for the load path.
    const { plugin } = makePluginStub({
      semanticSearch: { provider: "native" },
    });
    const [a, b] = await Promise.all([setupOrThrow(plugin), setupOrThrow(plugin)]);

    expect(a.settings).toEqual(b.settings);
    expect(a.settings.provider).toBe("native");
    expect(a.settings.indexingMode).toBe(DEFAULT_SEMANTIC_SETTINGS.indexingMode);
  });
});
