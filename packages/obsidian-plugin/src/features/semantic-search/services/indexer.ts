/**
 * Live semantic indexer (design § Indexing pipeline, design D9).
 *
 * Algorithm:
 *   - On `start`, run a full build over every markdown file currently
 *     in the vault (reused at first run + after a manual rebuild).
 *   - Subscribe to `vault.on('modify'|'create'|'delete')` and
 *     debounce per-path: rapid edits within `debounceMs` (default
 *     2000ms) collapse to a single re-process when the user stops
 *     typing on that file.
 *   - Per-file processing: read content, chunk, compare each new
 *     chunk's contentHash against the existing records for that
 *     filePath. Chunks whose hash matches reuse the existing
 *     vector (chunk-delta — no re-embed). New or changed chunks go
 *     through the embedder. Delete events (file gone) drop all
 *     records for that path.
 *
 * Vault access is injected via the `VaultLike` interface so the
 * production wiring (T11) supplies a thin wrapper around
 * `app.vault.on/getMarkdownFiles/read`, while tests use an in-memory
 * vault with synchronous event dispatch.
 */

import { logger } from "$/shared/logger";
import type { Chunk } from "./chunker";
import type { Embedder } from "./embedder";
import type { EmbeddingRecord, EmbeddingStore } from "./store";

export type ChunkerFn = (content: string) => Promise<Chunk[]>;

export type VaultEvent = "modify" | "create" | "delete";

export interface VaultLike {
  getMarkdownFiles(): Array<{ path: string }>;
  read(path: string): Promise<string>;
  /** Returns an unsubscribe function. */
  on(event: VaultEvent, handler: (path: string) => void): () => void;
}

export type LiveIndexerOpts = {
  vault: VaultLike;
  chunker: ChunkerFn;
  embedder: Embedder;
  store: EmbeddingStore;
  /** Per-file inactivity window before re-processing. Default 2000ms. */
  debounceMs?: number;
};

export interface SemanticIndexer {
  start(): Promise<void>;
  stop(): Promise<void>;
  /** Force a full re-build over all markdown files. */
  rebuildAll(): Promise<void>;
  /**
   * Drain any pending debounce timers and await every in-flight
   * file processing. Test helper — production code does not need
   * this since the timers fire on their own.
   */
  flush(): Promise<void>;
  /** Number of file paths with a pending debounce timer. */
  pending(): number;
}

const DEFAULT_DEBOUNCE_MS = 2000;

class LiveIndexerImpl implements SemanticIndexer {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private inFlight = new Map<string, Promise<void>>();
  private unsubs: Array<() => void> = [];
  private running = false;
  private readonly debounceMs: number;

  constructor(private opts: LiveIndexerOpts) {
    this.debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    this.unsubs.push(
      this.opts.vault.on("modify", (p) => this.schedule(p)),
      this.opts.vault.on("create", (p) => this.schedule(p)),
      this.opts.vault.on("delete", (p) => this.schedule(p)),
    );

    await this.rebuildAll();
  }

  async stop(): Promise<void> {
    this.running = false;
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    for (const u of this.unsubs) u();
    this.unsubs = [];
    // Wait for any in-flight processing to finish so the store is
    // not mid-mutation when the caller drops it.
    await Promise.all(this.inFlight.values());
  }

  async rebuildAll(): Promise<void> {
    const files = this.opts.vault.getMarkdownFiles();
    for (const f of files) {
      await this.processFile(f.path);
    }
  }

  async flush(): Promise<void> {
    // Fire every pending timer immediately and wait for all the
    // resulting processing to settle.
    const pending = Array.from(this.timers.entries());
    for (const [, t] of pending) clearTimeout(t);
    this.timers.clear();
    await Promise.all(
      pending.map(async ([path]) => {
        await this.processFile(path);
      }),
    );
    await Promise.all(this.inFlight.values());
  }

  pending(): number {
    return this.timers.size;
  }

  private schedule(path: string): void {
    if (!this.running) return;
    const existing = this.timers.get(path);
    if (existing) clearTimeout(existing);
    const handle = setTimeout(() => {
      this.timers.delete(path);
      this.processFile(path).catch((err) => {
        logger.error("live indexer: process failed", {
          path,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }, this.debounceMs);
    this.timers.set(path, handle);
  }

  private async processFile(path: string): Promise<void> {
    // Serialize per-path so a fast modify→delete sequence does not
    // race the in-flight processor for the prior modify event.
    const prior = this.inFlight.get(path);
    const next = (async () => {
      if (prior) await prior;
      await this.doProcessFile(path);
    })();
    this.inFlight.set(path, next);
    try {
      await next;
    } finally {
      // Only clear inFlight if our promise is still the current one
      // (a later schedule may have queued behind).
      if (this.inFlight.get(path) === next) this.inFlight.delete(path);
    }
  }

  private async doProcessFile(path: string): Promise<void> {
    let content: string | null;
    try {
      content = await this.opts.vault.read(path);
    } catch {
      // File no longer readable (deleted, renamed, or permission
      // issue). Drop everything we had indexed for it.
      content = null;
    }

    if (content === null) {
      await this.opts.store.delete(path);
      return;
    }

    const chunks = await this.opts.chunker(content);
    if (chunks.length === 0) {
      // File became too small or all sections below the min-token
      // threshold — treat as a delete from the index.
      await this.opts.store.delete(path);
      return;
    }

    // Index existing records for this path by contentHash so we can
    // reuse vectors for unchanged chunks (chunk-delta).
    const existingByHash = new Map<string, EmbeddingRecord>();
    for await (const r of this.opts.store.scan()) {
      if (r.filePath === path) existingByHash.set(r.contentHash, r);
    }

    const records: EmbeddingRecord[] = [];
    for (const c of chunks) {
      const reused = existingByHash.get(c.contentHash);
      const vector = reused?.vector ?? (await this.opts.embedder.embed(c.text));
      records.push({
        chunkId: `${path}#${c.id}`,
        filePath: path,
        offset: c.offset,
        heading: c.heading,
        contentHash: c.contentHash,
        vector,
      });
    }

    // Replace the entire set of records for this path. The store's
    // upsert by chunkId would leave stranded records when the new
    // chunk count is smaller than the old — easier to delete first.
    await this.opts.store.delete(path);
    await this.opts.store.upsert(records);
  }
}

export function createLiveIndexer(opts: LiveIndexerOpts): SemanticIndexer {
  return new LiveIndexerImpl(opts);
}
