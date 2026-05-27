# SPEC: Transformers.js v4 upgrade + ONNX IR v10 compatibility fix

## Objective

Upgrade `@xenova/transformers` v2.17.2 to `@huggingface/transformers` v4 (+ matching
`onnxruntime-web` ≥ 1.20) to resolve the ONNX IR version mismatch that prevents
EmbeddingGemma 300M from loading. Incidentally resolves the silent-fallback and
`.split` crash reported in issue #202.

## Problem statement

`@xenova/transformers` v2.17.2 ships an `onnxruntime-web` that caps ONNX IR at v8.
EmbeddingGemma 300M is exported at ONNX IR v10. Both the `webgpu_fp32` and `wasm`
backends fail with `Unsupported model IR version: 10, max supported IR version: 8`
before any inference runs. Downstream bugs (silent fallback to MiniLM, `.split`
crash at query time) are consequences of the model never loading. Full root-cause
fix is the runtime upgrade.

## Scope

### In scope
- Replace `@xenova/transformers` with `@huggingface/transformers` v4 across all
  embedding providers (`TransformersProvider` base, `EmbeddingGemmaProvider`,
  `MultilingualE5Provider`, `MiniLMProvider`).
- Update `onnxruntime-web` to ≥ 1.20 (included in `@huggingface/transformers` v4
  peer deps or bundled; verify pinned version).
- Verify + update HuggingFace model IDs for all three providers (IDs may differ
  between `Xenova/` namespace and `Hugging Face/` namespace in v4).
- Auto-detect WebGPU at provider init; fall back silently to WASM. No new settings
  UI or user-facing device selector.
- Bump `FORMAT_VERSION` 2 → 3 to invalidate v2-built indexes and trigger
  automatic re-indexing on first load (consistent with `migrateV1FlatStore` pattern).
- Update `onnxEnv.ts` `configureEnv()` for v4 API changes (env configuration,
  WASM paths, threading).

### Out of scope
- WebGPU manual selection UI (future work).
- Explicit null-guard fixes for Bug 2 / Bug 3 (expected as side-effects of the
  upgrade; covered by test assertions).
- Migration of the `@xenova/transformers` v2 → v3 intermediate step (jump
  directly to v4).
- Any changes outside `features/semantic-search/`.

## Stack / runtime constraints

| Constraint | Detail |
|---|---|
| Bundler | Bun 1.3.12, `bun.config.ts` — `external: ['obsidian', '@codemirror/*', '@lezer/*']` |
| Runtime | Obsidian Electron (desktop); WASM executed in renderer process |
| Known risk | `@xenova/transformers` v2 was pinned because v4 broke under Obsidian's plugin loader (`import.meta.url` resolution). This may be resolved in v4 — **Task 1 of the plan must verify this before any other implementation task runs**. If verification fails, the implementation falls back to defensive fixes (Bug 2 + Bug 3 null-guards) without the v4 upgrade. |
| Package rename | `@xenova/transformers` → `@huggingface/transformers` (occurred in v3, stable in v4) |
| ONNX IR | `@huggingface/transformers` v4 + `onnxruntime-web` ≥ 1.20 supports IR v10+ |

## Architecture

No structural changes to the embedding layer. All changes are within existing
provider classes and `onnxEnv.ts`. The `EmbeddingProvider` interface and
`EmbeddingStoreRegistry` are unchanged.

### Files affected
- `packages/obsidian-plugin/src/features/semantic-search/services/onnxEnv.ts` —
  `configureEnv()` updated for v4 API; add WebGPU auto-detect + WASM fallback.
- `packages/obsidian-plugin/src/features/semantic-search/services/providers/` —
  `transformersProvider.ts` base class + all three concrete providers: import path
  change, model ID verification, device selection via `env.backends`.
- `packages/obsidian-plugin/src/features/semantic-search/constants.ts` (or
  `types.ts`) — `FORMAT_VERSION` 2 → 3.
- `packages/obsidian-plugin/src/features/semantic-search/services/indexer.ts` —
  migration guard for FORMAT_VERSION 3 (wipe v2 index, trigger re-index banner).
- `packages/obsidian-plugin/package.json` — dependency swap.

## WebGPU backend selection

On provider init, `configureEnv()` probes `navigator.gpu` availability:
- If available: set `device: 'webgpu'`.
- Otherwise: set `device: 'wasm'` with SIMD + multi-thread where supported.

No user-visible configuration. The device actually used is logged at `INFO` level
via the shared `logger`. No settings panel change.

## Store migration

`FORMAT_VERSION` bump 2 → 3 at the top of `indexer.ts`. On load:

1. Detect stored `FORMAT_VERSION < 3`.
2. Delete the existing index directory for the active provider key.
3. Surface the re-index banner (existing UX, already used for v1→v2 migration).

Failure to delete is logged and surfaced via the re-index banner — same fail-open
pattern as `migrateV1FlatStore`.

## Edge cases

| Case | Handling |
|---|---|
| WebGPU available but model load fails | `configureEnv()` catches the session error, retries with `device: 'wasm'`. Logs the fallback at WARN. |
| v4 breaks Obsidian plugin loader (import.meta.url) | Task 1 must fail explicitly. Plan fallback = defensive Bug 2+3 fixes without runtime upgrade. |
| User had MiniLM index from v2 (FORMAT_VERSION 2) | Wiped on first load; re-index triggered. User notified via banner. |
| Model IDs changed in HuggingFace namespace | Task: verify each provider. If an ID is stale, update to the v4-compatible ID before writing any provider code. |
| onnxruntime-web version conflict in bun.lock | Pin explicitly in `package.json`; run `bun install --frozen-lockfile` to validate. |

## Success criteria

1. `bun run check` passes (no TypeScript errors).
2. `bun run build` produces a valid `main.js` (bundle smoke).
3. `cd packages/obsidian-plugin && bun test` — all tests green (999+/999+).
4. EmbeddingGemma 300M loads without ONNX IR error in a real Obsidian vault.
5. After indexing with EmbeddingGemma 300M, chunk count survives an Obsidian restart.
6. `search_vault_smart` returns results without crashing when EmbeddingGemma is the active provider.
7. Folotp confirms criteria 4–6 on their vault before the PR is merged to `main`.
