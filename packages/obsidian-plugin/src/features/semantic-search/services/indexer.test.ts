import { describe, expect, test, beforeEach } from "bun:test";
import { createLiveIndexer, type VaultEvent, type VaultLike } from "./indexer";
import type { Embedder } from "./embedder";
import { createEmbeddingStore, type EmbeddingRecord, type VaultAdapter } from "./store";
import type { Chunk } from "./chunker";

const DIM = 4;

/** In-memory vault with synchronous event dispatch. */
function makeVault(initial: Record<string, string> = {}): {
  vault: VaultLike;
  files: Map<string, string>;
  emit(event: VaultEvent, path: string): void;
} {
  const files = new Map<string, string>(Object.entries(initial));
  const handlers: Record<VaultEvent, Set<(p: string) => void>> = {
    modify: new Set(),
    create: new Set(),
    delete: new Set(),
  };
  const vault: VaultLike = {
    getMarkdownFiles: () =>
      Array.from(files.keys()).map((path) => ({ path })),
    read: async (path) => {
      const v = files.get(path);
      if (v === undefined) throw new Error(`ENOENT ${path}`);
      return v;
    },
    on: (event, handler) => {
      handlers[event].add(handler);
      return () => {
        handlers[event].delete(handler);
      };
    },
  };
  function emit(event: VaultEvent, path: string) {
    for (const h of handlers[event]) h(path);
  }
  return { vault, files, emit };
}

function memAdapter(): VaultAdapter {
  const f = new Map<string, string>();
  const b = new Map<string, ArrayBuffer>();
  return {
    async exists(p) {
      return f.has(p) || b.has(p);
    },
    async read(p) {
      const v = f.get(p);
      if (v === undefined) throw new Error(`ENOENT ${p}`);
      return v;
    },
    async write(p, d) {
      f.set(p, d);
    },
    async readBinary(p) {
      const v = b.get(p);
      if (v === undefined) throw new Error(`ENOENT ${p}`);
      return v.slice(0);
    },
    async writeBinary(p, d) {
      b.set(p, d.slice(0));
    },
    async remove(p) {
      f.delete(p);
      b.delete(p);
    },
  };
}

async function makeStore() {
  const store = createEmbeddingStore({
    adapter: memAdapter(),
    binPath: "/p/embeddings.bin",
    indexPath: "/p/embeddings.index.json",
    vectorDim: DIM,
  });
  await store.init();
  return store;
}

/**
 * Simple chunker: splits content on `---CHUNK---` markers.
 * Each chunk's contentHash is its position-stripped text so that
 * tests can reason about chunk-delta reuse without depending on
 * the real SHA-256 helper.
 */
async function fakeChunker(content: string): Promise<Chunk[]> {
  if (content.length === 0) return [];
  const parts = content.split("---CHUNK---").map((s) => s.trim()).filter(Boolean);
  return parts.map((text, i) => ({
    id: String(i),
    text,
    heading: null,
    offset: i * 10,
    contentHash: `h:${text}`,
  }));
}

function fakeEmbedder(): {
  embedder: Embedder;
  embeds: () => string[];
} {
  const calls: string[] = [];
  const embedder: Embedder = {
    embed: async (text) => {
      calls.push(text);
      const v = new Float32Array(DIM);
      v[0] = text.length;
      return v;
    },
    embedBatch: async (texts) => {
      const out: Float32Array[] = [];
      for (const t of texts) out.push(await embedder.embed(t));
      return out;
    },
    unload: async () => undefined,
    isLoaded: () => true,
  };
  return { embedder, embeds: () => [...calls] };
}

async function collect(store: Awaited<ReturnType<typeof makeStore>>): Promise<EmbeddingRecord[]> {
  const out: EmbeddingRecord[] = [];
  for await (const r of store.scan()) out.push(r);
  return out;
}

describe("live indexer", () => {
  let store: Awaited<ReturnType<typeof makeStore>>;

  beforeEach(async () => {
    store = await makeStore();
  });

  test("full build on start: indexes all markdown files", async () => {
    const { vault } = makeVault({
      "a.md": "alpha",
      "b.md": "bravo---CHUNK---bravo two",
    });
    const { embedder, embeds } = fakeEmbedder();
    const indexer = createLiveIndexer({ vault, chunker: fakeChunker, embedder, store, debounceMs: 30 });
    await indexer.start();
    await indexer.stop();

    expect(store.size()).toBe(3); // 1 + 2
    expect(embeds()).toEqual(expect.arrayContaining(["alpha", "bravo", "bravo two"]));
    const recs = await collect(store);
    expect(new Set(recs.map((r) => r.filePath))).toEqual(
      new Set(["a.md", "b.md"]),
    );
  });

  test("modify event re-embeds only changed chunks (chunk-delta)", async () => {
    const { vault, files, emit } = makeVault({
      "f.md": "one---CHUNK---two---CHUNK---three",
    });
    const { embedder, embeds } = fakeEmbedder();
    const indexer = createLiveIndexer({ vault, chunker: fakeChunker, embedder, store, debounceMs: 30 });
    await indexer.start();

    expect(embeds()).toEqual(["one", "two", "three"]);

    // Edit: replace chunk 2 only.
    files.set("f.md", "one---CHUNK---TWO!---CHUNK---three");
    emit("modify", "f.md");
    await indexer.flush();

    // Only "TWO!" is new — "one" and "three" reuse their existing
    // vectors via contentHash match.
    expect(embeds()).toEqual(["one", "two", "three", "TWO!"]);
    expect(store.size()).toBe(3);

    await indexer.stop();
  });

  test("create event embeds new chunks", async () => {
    const { vault, files, emit } = makeVault({});
    const { embedder, embeds } = fakeEmbedder();
    const indexer = createLiveIndexer({ vault, chunker: fakeChunker, embedder, store, debounceMs: 30 });
    await indexer.start();

    expect(store.size()).toBe(0);

    files.set("new.md", "fresh content");
    emit("create", "new.md");
    await indexer.flush();

    expect(embeds()).toEqual(["fresh content"]);
    expect(store.size()).toBe(1);

    await indexer.stop();
  });

  test("delete event removes all chunks for the path", async () => {
    const { vault, files, emit } = makeVault({
      "doomed.md": "a---CHUNK---b---CHUNK---c",
      "kept.md": "x",
    });
    const { embedder } = fakeEmbedder();
    const indexer = createLiveIndexer({ vault, chunker: fakeChunker, embedder, store, debounceMs: 30 });
    await indexer.start();

    expect(store.size()).toBe(4);

    files.delete("doomed.md");
    emit("delete", "doomed.md");
    await indexer.flush();

    expect(store.size()).toBe(1);
    const recs = await collect(store);
    expect(recs[0]?.filePath).toBe("kept.md");

    await indexer.stop();
  });

  test("debounce: rapid edits within debounceMs collapse to one process", async () => {
    const { vault, files, emit } = makeVault({
      "f.md": "v1",
    });
    const { embedder, embeds } = fakeEmbedder();
    const indexer = createLiveIndexer({ vault, chunker: fakeChunker, embedder, store, debounceMs: 50 });
    await indexer.start();

    files.set("f.md", "v2");
    emit("modify", "f.md");
    files.set("f.md", "v3");
    emit("modify", "f.md");
    files.set("f.md", "v4");
    emit("modify", "f.md");

    // Only one path has a pending timer (the same one keeps getting
    // rescheduled).
    expect(indexer.pending()).toBe(1);

    await indexer.flush();
    // Final state reflects v4. Initial build embedded "v1"; after
    // flush there is exactly one further embed for the new content.
    // Total embeds since start: ["v1", "v4"] — three rapid edits
    // collapsed into one re-process.
    expect(embeds()).toEqual(["v1", "v4"]);
    expect(store.size()).toBe(1);

    await indexer.stop();
  });

  test("stop unsubscribes from vault events (no further processing)", async () => {
    const { vault, files, emit } = makeVault({});
    const { embedder, embeds } = fakeEmbedder();
    const indexer = createLiveIndexer({ vault, chunker: fakeChunker, embedder, store, debounceMs: 30 });
    await indexer.start();
    await indexer.stop();

    files.set("post-stop.md", "should not embed");
    emit("create", "post-stop.md");
    // Wait long enough that any pending timer would have fired.
    await new Promise((r) => setTimeout(r, 80));

    expect(embeds()).toEqual([]); // nothing embedded after stop
    expect(store.size()).toBe(0);
  });

  test("rebuildAll re-processes the entire vault", async () => {
    const { vault, files } = makeVault({
      "a.md": "one",
      "b.md": "two",
    });
    const { embedder, embeds } = fakeEmbedder();
    const indexer = createLiveIndexer({ vault, chunker: fakeChunker, embedder, store, debounceMs: 30 });
    await indexer.start();
    expect(embeds()).toEqual(["one", "two"]);

    // Mutate vault directly without firing events; rebuildAll should
    // pick the new state up.
    files.set("a.md", "ONE!");
    files.set("c.md", "three");
    await indexer.rebuildAll();

    expect(embeds()).toEqual(["one", "two", "ONE!", "three"]);
    expect(store.size()).toBe(3);

    await indexer.stop();
  });

  test("chunker yielding zero chunks deletes any prior records for the path", async () => {
    const { vault, files, emit } = makeVault({
      "f.md": "content",
    });
    const { embedder } = fakeEmbedder();
    const indexer = createLiveIndexer({ vault, chunker: fakeChunker, embedder, store, debounceMs: 30 });
    await indexer.start();
    expect(store.size()).toBe(1);

    files.set("f.md", ""); // empty → fakeChunker returns []
    emit("modify", "f.md");
    await indexer.flush();
    expect(store.size()).toBe(0);

    await indexer.stop();
  });
});
