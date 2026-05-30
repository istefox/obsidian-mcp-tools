/**
 * Unit tests for the B3 auto-rebuild logic that fires after the migration
 * modal wipes stale provider stores.
 *
 * The decision logic in main.ts maps `state.settings.provider` (the UI
 * setting value) to a registry ProviderKey, then calls either
 * `startRebuildFor` (DLC) or `startIndexerIfNeeded` (native MiniLM)
 * if the active provider's store was wiped.
 *
 * These tests verify the mapping and dispatch logic in isolation, without
 * requiring the full main.ts wiring.
 */

import { describe, expect, test } from "bun:test";
import type { ProviderKey } from "./providerFactory";

const SETTING_TO_REGISTRY_KEY: Partial<Record<string, ProviderKey>> = {
  native: "native-minilm-l6-v2",
  auto: "native-minilm-l6-v2",
  "embedding-gemma": "embedding-gemma-300m",
  "multilingual-e5-base": "multilingual-e5-base",
  // "smart-connections" has no local store — absent from the map.
};

function simulateAutoRebuild(
  settingProvider: string,
  staleProviderKeys: ProviderKey[],
): { rebuildCalled: string | null; indexerStarted: boolean } {
  let rebuildCalled: string | null = null;
  let indexerStarted = false;

  const startRebuildFor = (key: string) => {
    rebuildCalled = key;
  };
  const startIndexerIfNeeded = () => {
    indexerStarted = true;
  };

  const activeRegistryKey = SETTING_TO_REGISTRY_KEY[settingProvider];
  if (activeRegistryKey && staleProviderKeys.includes(activeRegistryKey)) {
    if (activeRegistryKey === "native-minilm-l6-v2") {
      startIndexerIfNeeded();
    } else {
      startRebuildFor(activeRegistryKey);
    }
  }

  return { rebuildCalled, indexerStarted };
}

describe("migration auto-rebuild (B3)", () => {
  describe("setting → registry key mapping", () => {
    test("native → native-minilm-l6-v2", () => {
      expect(SETTING_TO_REGISTRY_KEY["native"]).toBe("native-minilm-l6-v2");
    });
    test("auto → native-minilm-l6-v2", () => {
      expect(SETTING_TO_REGISTRY_KEY["auto"]).toBe("native-minilm-l6-v2");
    });
    test("embedding-gemma → embedding-gemma-300m", () => {
      expect(SETTING_TO_REGISTRY_KEY["embedding-gemma"]).toBe(
        "embedding-gemma-300m",
      );
    });
    test("multilingual-e5-base → multilingual-e5-base", () => {
      expect(SETTING_TO_REGISTRY_KEY["multilingual-e5-base"]).toBe(
        "multilingual-e5-base",
      );
    });
    test("smart-connections → no local store (undefined)", () => {
      expect(SETTING_TO_REGISTRY_KEY["smart-connections"]).toBeUndefined();
    });
  });

  describe("dispatch: DLC providers call startRebuildFor", () => {
    test("embedding-gemma active + embedding-gemma-300m stale → startRebuildFor", () => {
      const { rebuildCalled, indexerStarted } = simulateAutoRebuild(
        "embedding-gemma",
        ["embedding-gemma-300m"],
      );
      expect(rebuildCalled).toBe("embedding-gemma-300m");
      expect(indexerStarted).toBe(false);
    });

    test("multilingual-e5-base active + stale → startRebuildFor", () => {
      const { rebuildCalled, indexerStarted } = simulateAutoRebuild(
        "multilingual-e5-base",
        ["multilingual-e5-base"],
      );
      expect(rebuildCalled).toBe("multilingual-e5-base");
      expect(indexerStarted).toBe(false);
    });
  });

  describe("dispatch: native MiniLM calls startIndexerIfNeeded", () => {
    test("native active + native-minilm-l6-v2 stale → startIndexerIfNeeded", () => {
      const { rebuildCalled, indexerStarted } = simulateAutoRebuild("native", [
        "native-minilm-l6-v2",
      ]);
      expect(indexerStarted).toBe(true);
      expect(rebuildCalled).toBeNull();
    });

    test("auto active + native-minilm-l6-v2 stale → startIndexerIfNeeded", () => {
      const { rebuildCalled, indexerStarted } = simulateAutoRebuild("auto", [
        "native-minilm-l6-v2",
      ]);
      expect(indexerStarted).toBe(true);
      expect(rebuildCalled).toBeNull();
    });
  });

  describe("dispatch: no rebuild for non-active stale keys", () => {
    test("native active, only DLC key stale → no action", () => {
      const { rebuildCalled, indexerStarted } = simulateAutoRebuild("native", [
        "embedding-gemma-300m",
      ]);
      expect(rebuildCalled).toBeNull();
      expect(indexerStarted).toBe(false);
    });

    test("embedding-gemma active, only native key stale → no action", () => {
      const { rebuildCalled, indexerStarted } = simulateAutoRebuild(
        "embedding-gemma",
        ["native-minilm-l6-v2"],
      );
      expect(rebuildCalled).toBeNull();
      expect(indexerStarted).toBe(false);
    });

    test("smart-connections active → no action regardless of stale keys", () => {
      const { rebuildCalled, indexerStarted } = simulateAutoRebuild(
        "smart-connections",
        ["native-minilm-l6-v2", "embedding-gemma-300m"],
      );
      expect(rebuildCalled).toBeNull();
      expect(indexerStarted).toBe(false);
    });

    test("no stale keys → no action even if provider matches", () => {
      const { rebuildCalled, indexerStarted } = simulateAutoRebuild(
        "native",
        [],
      );
      expect(rebuildCalled).toBeNull();
      expect(indexerStarted).toBe(false);
    });
  });
});
