/**
 * One-shot ONNX / Transformers.js environment configuration.
 *
 * Shared by embedder.ts (MiniLM path) and transformersProvider.ts
 * (multilingual providers) so the call-once guard is a module-level
 * singleton and both importers see the same `_envConfigured` flag.
 *
 * Why each setting:
 *
 * * `env.backends.onnx.wasm.wasmPaths`: onnxruntime-web's default
 *   wasm-blob loader resolves siblings via `fetch(new URL(...,
 *   import.meta.url))`. Bun's CJS bundle does not preserve
 *   `import.meta.url` meaningfully, so the loader 404s. Pointing at
 *   the matching CDN sidesteps the `import.meta.url` dance. Pinned to
 *   1.14.0 to match @xenova/transformers@2.17.2; updating the lib
 *   requires updating this URL or the WASM ABI may not match the JS
 *   glue.
 * * `env.backends.onnx.wasm.numThreads = 1`: Electron's renderer does
 *   not have COOP/COEP cross-origin isolation, so SharedArrayBuffer is
 *   restricted. Single-threaded WASM avoids the worker spin-up path.
 * * `env.allowLocalModels = false`: always use the remote (Hugging
 *   Face Hub) so the lazy first-call download flow drives the UI.
 * * `env.useBrowserCache = true`: persist the downloaded model to the
 *   Cache API so subsequent loads are fast.
 */

// Static import required: Obsidian's eval-based plugin loader cannot
// resolve node_modules at runtime; a bundled require() works, a
// dynamic `import(...)` would 404.
import { env as _xenovaEnv } from "@xenova/transformers";

const ORT_WASM_PATHS =
  "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/";

let _envConfigured = false;

export function configureEnv(): void {
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
