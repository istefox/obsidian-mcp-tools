import { type } from "arktype";

/**
 * Runtime schema for the semantic-search settings block.
 *
 * `provider` is the user-facing tri-state from design D7:
 *   - "native"            → always Transformers.js (T6 NativeProvider)
 *   - "smart-connections" → always Smart Connections (T7 wrapper); errors actionably if not installed
 *   - "auto"              → Smart Connections if loaded and ready, otherwise native
 *
 * `indexingMode` is design D9: live re-embedding on file change vs.
 * 5-minute batched scan. Only meaningful when the active provider
 * is `NativeProvider` — Smart Connections owns its own indexing.
 *
 * `unloadModelWhenIdle` is the additional power saver. When true,
 * the embedder unloads the MiniLM pipeline 60s after the last call;
 * next call re-loads (cold ~1s).
 */
export const semanticSearchSettingsSchema = type({
  provider: '"native"|"smart-connections"|"auto"',
  indexingMode: '"live"|"low-power"',
  unloadModelWhenIdle: "boolean",
});

export type SemanticSearchSettings = typeof semanticSearchSettingsSchema.infer;

export const DEFAULT_SEMANTIC_SETTINGS: SemanticSearchSettings = {
  provider: "auto",
  indexingMode: "live",
  unloadModelWhenIdle: true,
};

/**
 * Settings augmentation. Lives here (not in the root plugin types.ts)
 * per the .clinerules feature architecture rule: each feature owns its
 * own settings shape.
 */
declare module "obsidian" {
  interface McpToolsPluginSettings {
    semanticSearch?: SemanticSearchSettings;
  }
}
