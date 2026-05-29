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
 *   the version bundled with @huggingface/transformers@4.2.0; updating
 *   the lib requires updating this URL or the WASM ABI may not match
 *   the JS glue.
 * * `env.backends.onnx.wasm.numThreads = 1`: Electron's renderer does
 *   not have COOP/COEP cross-origin isolation, so SharedArrayBuffer is
 *   restricted. Single-threaded WASM avoids the worker spin-up path.
 * * `env.useBrowserCache = true`: persist the downloaded model to the
 *   Cache API so subsequent loads are fast.
 */

// Static import required: Obsidian's eval-based plugin loader cannot
// resolve node_modules at runtime; a bundled require() works, a
// dynamic `import(...)` would 404.
import { env as _hfEnv } from "@huggingface/transformers";
import { logger } from "$/shared/logger";

// Stable build; required for ONNX IR v10 support (onnxruntime-web ≥ 1.20).
const ORT_WASM_PATHS =
  "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/";

let _envConfigured = false;

export function configureEnv(): void {
  if (_envConfigured) return;
  _envConfigured = true;

  const e = _hfEnv as unknown as {
    backends?: {
      onnx?: {
        wasm?: { numThreads?: number; simd?: boolean; wasmPaths?: string };
      };
    };
    useBrowserCache?: boolean;
  };

  if (e.backends?.onnx?.wasm) {
    e.backends.onnx.wasm.wasmPaths = ORT_WASM_PATHS;
    e.backends.onnx.wasm.numThreads = 1;
    // simd: leave unset — onnxruntime-web auto-detects SIMD capability.
    // Forcing true causes silent load failures on older Electron builds
    // (pre-22) and in enterprise lockdown environments.
  } else {
    logger.warn(
      "onnxEnv: expected WASM backend shape not found — CDN paths not configured",
    );
  }
  // Guard: `navigator` is undefined in bun test (no DOM); Cache API is a production-only concern.
  if (typeof navigator !== "undefined") {
    e.useBrowserCache = true;
  }

  // WebGPU: deferred — requires requestAdapter() + pipeline call wiring.
}
