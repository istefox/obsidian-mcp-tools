/**
 * Embedder wrapper around Transformers.js feature-extraction pipelines.
 *
 * Three concerns layered around the underlying pipeline:
 * 1. **Lazy load** — the model (~25MB MiniLM-L6-v2) is downloaded and
 *    constructed only on the first `embed`/`embedBatch` call, never at
 *    module evaluation time. Two concurrent calls during the cold load
 *    share the same `Promise<Pipeline>` so the model is constructed
 *    exactly once.
 * 2. **LRU query cache** — identical query strings reuse the same
 *    `Float32Array` reference. Default size 32 (per design § Query
 *    pipeline). Exact-match cache; semantic dedupe is out of scope.
 * 3. **Unload-when-idle** — if `unloadWhenIdle` is true, the pipeline
 *    is dropped 60s after the last call (RAM saver for memory-
 *    constrained users). The next call cold-reloads.
 *
 * Production code injects `realPipelineFactory` (dynamic import of
 * `@xenova/transformers`) so Transformers.js is not pulled into the
 * bundle eager-side. Tests inject a deterministic mock factory: no
 * model download, no WASM, no sharp transitive resolution.
 */

const DEFAULT_MODEL = "Xenova/all-MiniLM-L6-v2";
const DEFAULT_CACHE_SIZE = 32;
const DEFAULT_IDLE_MS = 60_000;

/** Minimal subset of Transformers.js's pipeline output that we use. */
export type EmbedTensor = { data: Float32Array; dims?: number[] };

/**
 * The shape Transformers.js returns from
 * `await pipeline("feature-extraction", model)`. We type only the
 * call signature we use.
 */
export type PipelineFn = (
  input: string | string[],
  opts?: { pooling?: "mean" | "cls" | "none"; normalize?: boolean },
) => Promise<EmbedTensor>;

export type PipelineFactory = (model: string) => Promise<PipelineFn>;

/**
 * Progress event shape emitted by Transformers.js during model
 * download. Only the fields the UI surfaces are typed; the library
 * emits more (name, total, loaded, etc.) but they don't drive the
 * progress bar.
 */
export type ProgressEvent = {
  status: "initiate" | "download" | "progress" | "done" | "ready" | string;
  progress?: number; // 0-100
  file?: string;
};

export type ProgressCallback = (info: ProgressEvent) => void;

/**
 * Variant of PipelineFactory that forwards Transformers.js progress
 * events. The model downloader (T13) wraps an instance of this and
 * exposes the resulting state machine to the settings UI.
 */
export type PipelineFactoryWithProgress = (
  model: string,
  onProgress?: ProgressCallback,
) => Promise<PipelineFn>;

export interface Embedder {
  embed(text: string): Promise<Float32Array>;
  embedBatch(texts: string[]): Promise<Float32Array[]>;
  unload(): Promise<void>;
  isLoaded(): boolean;
}

export type EmbedderOpts = {
  pipelineFactory: PipelineFactory;
  model?: string;
  cacheSize?: number;
  idleMs?: number;
  unloadWhenIdle?: boolean;
};

class EmbedderImpl implements Embedder {
  private pipeline: PipelineFn | null = null;
  private loadPromise: Promise<PipelineFn> | null = null;
  // Cache stores Promise<Float32Array> rather than Float32Array so
  // concurrent embed(sameText) calls share the in-flight work and
  // resolve to the same array reference. Identity holds across
  // duplicates within an embedBatch call, which the indexer relies on
  // when chunk-delta detection re-embeds a partial set.
  private cache = new Map<string, Promise<Float32Array>>();
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private opts: EmbedderOpts) {}

  isLoaded(): boolean {
    return this.pipeline !== null;
  }

  async embed(text: string): Promise<Float32Array> {
    this.touchIdle();

    const cached = this.cache.get(text);
    if (cached) {
      // LRU touch: delete + reinsert so this entry is the most-recent.
      this.cache.delete(text);
      this.cache.set(text, cached);
      return cached;
    }

    const promise = (async (): Promise<Float32Array> => {
      const pipe = await this.ensurePipeline();
      const result = await pipe(text, { pooling: "mean", normalize: true });
      // Copy into a fresh Float32Array so the cache holds an owned
      // reference even if the pipeline reuses internal buffers.
      return new Float32Array(result.data);
    })();
    this.cacheSet(text, promise);
    return promise;
  }

  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    // Each call routes through the per-string cache, so duplicated
    // batch entries reuse work. Concurrency is fine: the first batch
    // call triggers `ensurePipeline()` and the rest await the same
    // promise.
    return Promise.all(texts.map((t) => this.embed(t)));
  }

  async unload(): Promise<void> {
    this.pipeline = null;
    this.loadPromise = null;
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private async ensurePipeline(): Promise<PipelineFn> {
    if (this.pipeline) return this.pipeline;
    if (!this.loadPromise) {
      const model = this.opts.model ?? DEFAULT_MODEL;
      this.loadPromise = this.opts.pipelineFactory(model).then((p) => {
        this.pipeline = p;
        return p;
      });
    }
    return this.loadPromise;
  }

  private cacheSet(text: string, promise: Promise<Float32Array>): void {
    const max = this.opts.cacheSize ?? DEFAULT_CACHE_SIZE;
    if (this.cache.size >= max) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(text, promise);
  }

  private touchIdle(): void {
    if (this.opts.unloadWhenIdle === false) return;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.pipeline = null;
      this.loadPromise = null;
      this.idleTimer = null;
    }, this.opts.idleMs ?? DEFAULT_IDLE_MS);
  }
}

export function createEmbedder(opts: EmbedderOpts): Embedder {
  return new EmbedderImpl(opts);
}

/**
 * Production pipeline factory. Dynamically imports Transformers.js so
 * the heavy ONNX runtime + tokenizer code is not pulled into the
 * plugin bundle until the first embed call. Tests must NOT call this;
 * they inject a deterministic mock factory instead.
 *
 * Wrapped in a function (not a top-level `import`) so the bundler
 * can split the chunk and so the sharp transitive dependency (which
 * Transformers.js's image pipelines pull in) is never touched in the
 * text-only path we actually use.
 */
// Static import: bundles Transformers.js into main.js. Static beats
// dynamic in Obsidian/Electron because the plugin runtime does not
// resolve node_modules — a bundled require() works, a runtime
// `import(...)` would 404.
//
// `sharp` is stubbed at bundle time (image pipelines are unreachable in
// our text-only path). `onnxruntime-node` is REDIRECTED to
// `onnxruntime-web` at bundle time — see bun.config.ts for the rationale
// (Electron renderer reports `process.release.name === 'node'`, so
// Transformers.js v2.17.2 picks the node branch; routing it to the WASM
// runtime is the only way to actually run inference here).
//
// Pinned to @xenova/transformers v2.17.2. The successor
// @huggingface/transformers v4 was tested 2026-04-26 in a spike; it
// uses `import.meta.url` at runtime which Obsidian's eval-based plugin
// loader cannot parse. Reverting to v2 keeps the plugin loadable.
import {
  pipeline as _xenovaPipeline,
  env as _xenovaEnv,
} from "@xenova/transformers";

// One-shot ONNX runtime configuration applied the first time
// realPipelineFactory is called. Reasons for each setting:
//
// * `env.backends.onnx.wasm.wasmPaths`: onnxruntime-web's default
//   wasm-blob loader resolves siblings via `fetch(new URL(...,
//   import.meta.url))`. Bun's CJS bundle does not preserve
//   `import.meta.url` meaningfully, so the loader 404s. Pointing at
//   the matching CDN sidesteps the whole `import.meta.url` dance.
//   Pinned to 1.14.0 to match @xenova/transformers@2.17.2's bundled
//   onnxruntime-web; updating the lib also requires updating this URL
//   or the WASM ABI may not match the JS glue.
// * `env.backends.onnx.wasm.numThreads = 1`: Electron's renderer does
//   not have COOP/COEP cross-origin isolation headers, so
//   SharedArrayBuffer is restricted. Single-threaded WASM avoids the
//   worker spin-up path entirely.
// * `env.allowLocalModels = false`: always use the remote (Hugging
//   Face Hub), so the lazy first-call download flow drives the
//   ModelDownloader UI.
// * `env.useBrowserCache = true`: persist the downloaded model to the
//   Cache API so subsequent loads are fast.
const ORT_WASM_PATHS =
  "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/";

let _envConfigured = false;
function configureEnv(): void {
  if (_envConfigured) return;
  _envConfigured = true;
  const e = _xenovaEnv as unknown as {
    backends?: {
      onnx?: {
        wasm?: { numThreads?: number; simd?: boolean; wasmPaths?: string };
      };
    };
    allowLocalModels?: boolean;
    useBrowserCache?: boolean;
  };
  if (e.backends?.onnx?.wasm) {
    e.backends.onnx.wasm.wasmPaths = ORT_WASM_PATHS;
    e.backends.onnx.wasm.numThreads = 1;
    e.backends.onnx.wasm.simd = true;
  }
  e.allowLocalModels = false;
  e.useBrowserCache = true;
}

export async function realPipelineFactory(
  model: string,
  onProgress?: ProgressCallback,
): Promise<PipelineFn> {
  configureEnv();
  const pipe = await _xenovaPipeline("feature-extraction", model, {
    progress_callback: onProgress,
  } as Parameters<typeof _xenovaPipeline>[2]);
  return pipe as unknown as PipelineFn;
}
