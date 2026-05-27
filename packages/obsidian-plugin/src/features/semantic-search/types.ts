import { type } from "arktype";

/**
 * Embedding layer abstraction. One `EmbeddingProvider` per model;
 * the store registry and indexer are keyed on `providerKey`.
 *
 * `embed` accepts a batch and a role so providers that use asymmetric
 * task prompts (EmbeddingGemma, multilingual-e5) can apply them
 * internally without leaking the prompt format to callers.
 */
export interface EmbeddingProvider {
  readonly providerKey: string;
  readonly dimensions: number;
  readonly maxInputTokens: number;
  embed(texts: string[], role: "document" | "query"): Promise<Float32Array[]>;
  isAvailable(): Promise<boolean>;
  getModelSizeBytes(): number;
}

/**
 * Runtime schema for the semantic-search settings block.
 *
 * `provider` values:
 *   - "native"              → always Transformers.js MiniLM (NativeProvider)
 *   - "smart-connections"   → always Smart Connections; errors if not installed
 *   - "auto"                → Smart Connections if loaded and ready, else native
 *   - "embedding-gemma"     → EmbeddingGemma 300M (~190 MB, multilingual, 768d)
 *   - "multilingual-e5-base"→ Multilingual E5 base (~100 MB, multilingual, 768d)
 *
 * `indexingMode`: live re-embedding on file change vs.
 * 5-minute batched scan. Only meaningful when the active provider
 * is `NativeProvider` — Smart Connections owns its own indexing.
 *
 * `unloadModelWhenIdle` is the additional power saver. When true,
 * the embedder unloads the MiniLM pipeline 60s after the last call;
 * next call re-loads (cold ~1s).
 */
export const semanticSearchSettingsSchema = type({
  provider:
    '"native"|"smart-connections"|"auto"|"embedding-gemma"|"multilingual-e5-base"',
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
