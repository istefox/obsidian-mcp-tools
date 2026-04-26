/**
 * Provider factory — selects the active SemanticSearchProvider based
 * on the user's tri-state setting (design D7).
 *
 * Behavior matrix:
 *   provider="native"            → always NativeProvider
 *   provider="smart-connections" → always SmartConnectionsProvider
 *                                  (its `search` throws an actionable
 *                                  error if SC is not loaded)
 *   provider="auto"              → SmartConnectionsProvider if SC is
 *                                  loaded, else NativeProvider
 *
 * The factory is constructed once with stable dependencies (embedder,
 * store, excerptResolver, plugin handle) and returns a closure that
 * maps a `SemanticSearchSettings` instance to a provider. Settings
 * changes (T12 UI swap) call the closure again to swap the live
 * provider; the dependencies are unchanged across swaps.
 */

import type McpToolsPlugin from "$/main";
import type { SemanticSearchProvider } from "$/features/semantic-search";
import type { SemanticSearchSettings } from "$/features/semantic-search/types";
import { createNativeProvider, type ExcerptResolver } from "./nativeProvider";
import { createSmartConnectionsProvider } from "./smartConnectionsProvider";
import type { Embedder } from "./embedder";
import type { EmbeddingStore } from "./store";

export type ProviderFactoryDeps = {
  plugin: McpToolsPlugin;
  embedder: Embedder;
  store: EmbeddingStore;
  excerptResolver?: ExcerptResolver;
};

export type ProviderChooser = (
  settings: SemanticSearchSettings,
) => SemanticSearchProvider;

/**
 * Probe whether the Smart Connections plugin's SmartSearch surface
 * is loaded and ready to be called. The check is the same as the
 * one inside SmartConnectionsProvider but lives here too so the
 * factory can resolve `provider="auto"` without constructing a
 * provider just to ask.
 */
export function isSmartConnectionsAvailable(plugin: McpToolsPlugin): boolean {
  const sc = (plugin as unknown as { smartSearch?: { search?: unknown } })
    .smartSearch;
  return typeof sc?.search === "function";
}

export function createProviderFactory(
  deps: ProviderFactoryDeps,
): ProviderChooser {
  const buildNative = (): SemanticSearchProvider =>
    createNativeProvider({
      embedder: deps.embedder,
      store: deps.store,
      excerptResolver: deps.excerptResolver,
    });

  const buildSmart = (): SemanticSearchProvider =>
    createSmartConnectionsProvider(deps.plugin);

  return (settings) => {
    switch (settings.provider) {
      case "native":
        return buildNative();
      case "smart-connections":
        return buildSmart();
      case "auto":
        return isSmartConnectionsAvailable(deps.plugin)
          ? buildSmart()
          : buildNative();
    }
  };
}
