import { describe, expect, test, beforeEach } from "bun:test";
import {
  createEmbeddingStore,
  FORMAT_VERSION,
  type EmbeddingRecord,
  type VaultAdapter,
} from "./store";

/**
 * In-memory vault adapter shared across the test cases. Stores text
 * and binary blobs in two Maps keyed by path. Mirrors the behavior
 * of Obsidian's `vault.adapter` for the surface the store actually
 * uses — exists/read/write/readBinary/writeBinary/remove.
 */
function makeMemAdapter(): {
  adapter: VaultAdapter;
  files: Map<string, string>;
  bins: Map<string, ArrayBuffer>;
} {
  const files = new Map<string, string>();
  const bins = new Map<string, ArrayBuffer>();
  const adapter: VaultAdapter = {
    async exists(path) {
      return files.has(path) || bins.has(path);
    },
    async read(path) {
      const v = files.get(path);
      if (v === undefined) throw new Error(`ENOENT ${path}`);
      return v;
    },
    async write(path, data) {
      files.set(path, data);
    },
    async readBinary(path) {
      const v = bins.get(path);
      if (v === undefined) throw new Error(`ENOENT ${path}`);
      // Return a copy so writers don't mutate readers.
      return v.slice(0);
    },
    async writeBinary(path, data) {
      bins.set(path, data.slice(0));
    },
    async remove(path) {
      files.delete(path);
      bins.delete(path);
    },
  };
  return { adapter, files, bins };
}

const DIM = 4; // small fixed dimension to keep test math readable

function makeVector(seed: number): Float32Array {
  const v = new Float32Array(DIM);
  for (let i = 0; i < DIM; i++) v[i] = seed * 0.1 + i * 0.01;
  return v;
}

function makeRecord(opts: Partial<EmbeddingRecord> & { chunkId: string }): EmbeddingRecord {
  return {
    chunkId: opts.chunkId,
    filePath: opts.filePath ?? "Notes/a.md",
    offset: opts.offset ?? 0,
    heading: opts.heading ?? null,
    contentHash: opts.contentHash ?? "deadbeefdeadbeef",
    vector: opts.vector ?? makeVector(opts.chunkId.length),
  };
}

describe("embedding store", () => {
  let mem: ReturnType<typeof makeMemAdapter>;
  beforeEach(() => {
    mem = makeMemAdapter();
  });

  test("init on empty: size === 0, no files written until flush", async () => {
    const store = createEmbeddingStore({
      adapter: mem.adapter,
      binPath: "/p/embeddings.bin",
      indexPath: "/p/embeddings.index.json",
      vectorDim: DIM,
    });
    await store.init();
    expect(store.size()).toBe(0);
    expect(mem.files.size).toBe(0);
    expect(mem.bins.size).toBe(0);
  });

  test("upsert + size: 3 records → size === 3", async () => {
    const store = createEmbeddingStore({
      adapter: mem.adapter,
      binPath: "/p/embeddings.bin",
      indexPath: "/p/embeddings.index.json",
      vectorDim: DIM,
    });
    await store.init();
    await store.upsert([
      makeRecord({ chunkId: "a:0" }),
      makeRecord({ chunkId: "a:1" }),
      makeRecord({ chunkId: "b:0", filePath: "Notes/b.md" }),
    ]);
    expect(store.size()).toBe(3);
  });

  test("upsert with existing chunkId replaces in place", async () => {
    const store = createEmbeddingStore({
      adapter: mem.adapter,
      binPath: "/p/embeddings.bin",
      indexPath: "/p/embeddings.index.json",
      vectorDim: DIM,
    });
    await store.init();
    await store.upsert([makeRecord({ chunkId: "x:0", contentHash: "v1" })]);
    await store.upsert([makeRecord({ chunkId: "x:0", contentHash: "v2" })]);
    expect(store.size()).toBe(1);
    const seen: EmbeddingRecord[] = [];
    for await (const r of store.scan()) seen.push(r);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.contentHash).toBe("v2");
  });

  test("delete by filePath removes all chunks for that path", async () => {
    const store = createEmbeddingStore({
      adapter: mem.adapter,
      binPath: "/p/embeddings.bin",
      indexPath: "/p/embeddings.index.json",
      vectorDim: DIM,
    });
    await store.init();
    await store.upsert([
      makeRecord({ chunkId: "a:0", filePath: "Notes/a.md" }),
      makeRecord({ chunkId: "a:1", filePath: "Notes/a.md" }),
      makeRecord({ chunkId: "b:0", filePath: "Notes/b.md" }),
    ]);
    await store.delete("Notes/a.md");
    expect(store.size()).toBe(1);
    const seen: EmbeddingRecord[] = [];
    for await (const r of store.scan()) seen.push(r);
    expect(seen[0]?.filePath).toBe("Notes/b.md");
  });

  test("scan yields all records in insertion order", async () => {
    const store = createEmbeddingStore({
      adapter: mem.adapter,
      binPath: "/p/embeddings.bin",
      indexPath: "/p/embeddings.index.json",
      vectorDim: DIM,
    });
    await store.init();
    const ids = ["a:0", "b:0", "c:0"];
    await store.upsert(ids.map((id) => makeRecord({ chunkId: id })));
    const seenIds: string[] = [];
    for await (const r of store.scan()) seenIds.push(r.chunkId);
    expect(seenIds).toEqual(ids);
  });

  test("flush + reopen: state persists across init cycles", async () => {
    const opts = {
      adapter: mem.adapter,
      binPath: "/p/embeddings.bin",
      indexPath: "/p/embeddings.index.json",
      vectorDim: DIM,
    };
    const a = createEmbeddingStore(opts);
    await a.init();
    const v1 = makeVector(7);
    const v2 = makeVector(13);
    await a.upsert([
      makeRecord({ chunkId: "x:0", vector: v1, contentHash: "h1" }),
      makeRecord({ chunkId: "y:0", vector: v2, contentHash: "h2", filePath: "Y.md" }),
    ]);
    await a.flush();

    const b = createEmbeddingStore(opts);
    await b.init();
    expect(b.size()).toBe(2);
    const records: Record<string, EmbeddingRecord> = {};
    for await (const r of b.scan()) records[r.chunkId] = r;

    expect(records["x:0"]?.contentHash).toBe("h1");
    expect(records["y:0"]?.filePath).toBe("Y.md");
    // Vectors round-tripped exactly (Float32 is lossless to itself).
    for (let i = 0; i < DIM; i++) {
      expect(records["x:0"]?.vector[i]).toBeCloseTo(v1[i] ?? 0, 6);
      expect(records["y:0"]?.vector[i]).toBeCloseTo(v2[i] ?? 0, 6);
    }
  });

  test("format version mismatch → re-init from scratch (logged warning)", async () => {
    // Pre-populate the index file with a wrong version.
    await mem.adapter.write(
      "/p/embeddings.index.json",
      JSON.stringify({ version: FORMAT_VERSION + 1, records: [] }),
    );
    const store = createEmbeddingStore({
      adapter: mem.adapter,
      binPath: "/p/embeddings.bin",
      indexPath: "/p/embeddings.index.json",
      vectorDim: DIM,
    });
    await store.init();
    expect(store.size()).toBe(0);
    // Subsequent upsert + flush should overwrite with the current version.
    await store.upsert([makeRecord({ chunkId: "a:0" })]);
    await store.flush();
    const written = JSON.parse(mem.files.get("/p/embeddings.index.json") ?? "{}");
    expect(written.version).toBe(FORMAT_VERSION);
    expect(written.records).toHaveLength(1);
  });

  test("upsert rejects vector with wrong dimensionality", async () => {
    const store = createEmbeddingStore({
      adapter: mem.adapter,
      binPath: "/p/embeddings.bin",
      indexPath: "/p/embeddings.index.json",
      vectorDim: DIM,
    });
    await store.init();
    const wrong = new Float32Array(DIM + 1);
    await expect(
      store.upsert([makeRecord({ chunkId: "bad:0", vector: wrong })]),
    ).rejects.toThrow(/dim mismatch/);
  });

  test("close flushes and clears state", async () => {
    const store = createEmbeddingStore({
      adapter: mem.adapter,
      binPath: "/p/embeddings.bin",
      indexPath: "/p/embeddings.index.json",
      vectorDim: DIM,
    });
    await store.init();
    await store.upsert([makeRecord({ chunkId: "a:0" })]);
    await store.close();
    // The index file should be on disk after close.
    expect(mem.files.has("/p/embeddings.index.json")).toBe(true);
    // size() reads internal state which was cleared.
    expect(store.size()).toBe(0);
  });
});
