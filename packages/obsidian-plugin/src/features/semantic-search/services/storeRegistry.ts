import { logger } from "$/shared/logger";
import {
  createEmbeddingStore,
  type EmbeddingStore,
  type VaultAdapter,
} from "./store";

export interface EmbeddingStoreRegistry {
  storeFor(providerKey: string, vectorDim: number): EmbeddingStore;
  markReady(providerKey: string): void;
  isReady(providerKey: string): boolean;
  close(providerKey: string): Promise<void>;
  closeAll(): Promise<void>;
}

class EmbeddingStoreRegistryImpl implements EmbeddingStoreRegistry {
  private stores = new Map<string, EmbeddingStore>();
  private ready = new Set<string>();

  constructor(
    private adapter: VaultAdapter,
    private baseDir: string,
  ) {}

  storeFor(providerKey: string, vectorDim: number): EmbeddingStore {
    const existing = this.stores.get(providerKey);
    if (existing) return existing;
    const store = createEmbeddingStore({
      adapter: this.adapter,
      binPath: `${this.baseDir}/${providerKey}/embeddings.bin`,
      indexPath: `${this.baseDir}/${providerKey}/embeddings.index.json`,
      vectorDim,
    });
    this.stores.set(providerKey, store);
    return store;
  }

  markReady(providerKey: string): void {
    this.ready.add(providerKey);
  }

  isReady(providerKey: string): boolean {
    return this.ready.has(providerKey);
  }

  async close(providerKey: string): Promise<void> {
    const store = this.stores.get(providerKey);
    if (!store) return;
    await store.close();
    this.stores.delete(providerKey);
    this.ready.delete(providerKey);
  }

  async closeAll(): Promise<void> {
    const keys = Array.from(this.stores.keys());
    await Promise.all(keys.map((k) => this.close(k)));
  }
}

export function createEmbeddingStoreRegistry(
  adapter: VaultAdapter,
  baseDir: string,
): EmbeddingStoreRegistry {
  return new EmbeddingStoreRegistryImpl(adapter, baseDir);
}

/**
 * One-time migration: moves the v1 flat store pair
 * (`${pluginDir}/embeddings.bin` + `embeddings.index.json`) to the
 * per-providerKey directory (`embeddings/native-minilm-l6-v2/`).
 * Idempotent: no-op when the flat bin is absent.
 * Failures are logged and swallowed — the re-index banner handles
 * the case where the store is absent at the new path.
 */
export async function migrateV1FlatStore(
  adapter: VaultAdapter,
  pluginDir: string,
): Promise<void> {
  const srcBin = `${pluginDir}/embeddings.bin`;
  try {
    if (!(await adapter.exists(srcBin))) return;

    const srcIndex = `${pluginDir}/embeddings.index.json`;
    const dstDir = `${pluginDir}/embeddings/native-minilm-l6-v2`;

    const sentinelPath = `${dstDir}/.migrating`;

    // If a prior interrupted migration left a sentinel, skip — the
    // partial destination will be ignored (no index at new path → re-index
    // banner fires on next startup).
    if (await adapter.exists(sentinelPath)) return;

    const binData = await adapter.readBinary(srcBin);
    await adapter.mkdir(dstDir);
    await adapter.write(sentinelPath, "");
    await adapter.writeBinary(`${dstDir}/embeddings.bin`, binData);
    await adapter.remove(srcBin);

    if (await adapter.exists(srcIndex)) {
      const indexData = await adapter.read(srcIndex);
      await adapter.write(`${dstDir}/embeddings.index.json`, indexData);
      await adapter.remove(srcIndex);
    }

    await adapter.remove(sentinelPath);
    logger.info(
      "semantic-search: v1 flat store migrated to per-provider directory",
      { pluginDir },
    );
  } catch (error) {
    logger.warn("v1 flat store migration failed; store will be re-indexed", {
      pluginDir,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
