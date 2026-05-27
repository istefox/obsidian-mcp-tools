# ADR-0007 — Transformers.js v4 upgrade + ONNX IR v10 compatibility fix

**Status:** Proposed  
**Date:** 2026-05-27  
**Deciders:** Stefano Ferri

---

## Context

`@xenova/transformers` v2.17.2 bundles `onnxruntime-web` pinned to a version that
caps ONNX IR at v8. `onnx-community/embeddinggemma-300m-ONNX` is exported at IR
v10; both the `webgpu_fp32` and `wasm` backends abort with
`Unsupported model IR version: 10, max supported IR version: 8` before any
inference runs. Downstream symptoms (silent fallback to MiniLM, `.split` crash
at query time) are consequences of the model never loading; they require no
independent fix if the runtime is upgraded.

`@xenova/transformers` was previously pinned to v2.17.2 after a 2026-04-26 spike
found that v4 (`@huggingface/transformers`) fails under Obsidian's eval-based
plugin loader due to `import.meta.url` references at module init. That spike
outcome is the primary risk this work re-tests.

Two structural questions must be resolved before any code is written:

1. **Task 0 (pre-spike):** Does an ONNX IR ≤ v8 export of EmbeddingGemma 300M
   exist on HuggingFace? If yes, the fix degrades to a model-ID update with no
   dependency change, and the upgrade path is bypassed entirely.
2. **Task 1 (spike):** Does `@huggingface/transformers` v4 load cleanly under
   Obsidian's Electron plugin loader with the Bun CJS bundler? If the spike
   fails, the implementation falls back to defensive null-guards for Bug 2 + Bug
   3 only, with no runtime upgrade.

The FORMAT_VERSION bump (2 → 3) invalidates existing indexes, which may
represent hours of embedding work for large vaults. Silent background re-index
(the v1 → v2 pattern) is insufficient; the upgrade must surface an explicit
blocking dialog before wiping.

---

## Decision

**Adopt Alternative C (single-PR with mandatory spike gate), enhanced with the
explicit pre-wipe dialog requirement from the BRAINSTORM.**

One PR encompasses the full upgrade: dependency swap, provider import updates,
model-ID verification, `onnxEnv.ts` v4 API update, WebGPU auto-detect with
session-level fallback, FORMAT_VERSION 2 → 3, and a blocking confirmation
dialog before the index wipe. Task 0 (model-ID hunt) and Task 1 (compatibility
spike) gate all downstream tasks.

---

## Alternatives considered

### Alternative A — IR ≤ v8 model export only

Find or produce an ONNX IR ≤ v8 export of EmbeddingGemma 300M and update the
model ID; keep `@xenova/transformers` v2.17.2.

**Rejected because:** This is Task 0 of the plan, not a standalone alternative.
If Task 0 succeeds (an IR ≤ v8 export exists), it becomes the implementation
path. If it fails — which is likely, since the upstream export is authoritative
at IR v10 — the approach is unavailable. It accumulates technical debt regardless
(the underlying runtime remains capped at IR v8, blocking future IR v10 models).
Not a viable standalone strategy.

### Alternative B — Two-PR: runtime first (WASM-only), WebGPU second

PR 1: upgrade runtime to v4, force `device: 'wasm'`, FORMAT_VERSION bump. PR 2:
add WebGPU auto-detect after hardware validation.

**Rejected because:** Produces two review cycles with no material reduction in
blast radius. The loader compatibility risk (the primary blocker) is identical
in both PRs. WebGPU fallback is a self-contained add within `onnxEnv.ts` and
adds no architectural coupling; separating it delays the feature without a
safety benefit. The single-PR spike gate achieves the same risk management
without the second review cycle.

### Alternative C — Single-PR with spike gate (selected)

One PR. Task 0 (model-ID hunt) and Task 1 (loader compatibility spike) are
explicit gating steps. If Task 1 fails: the PR scope collapses to Bug 2 + Bug 3
null-guards. If Task 1 passes: the full implementation proceeds.

**Selected because:** One review cycle; the risk gate is explicit and blocking
within the plan; WebGPU auto-detect is included from the start. Folotp
validation on a real vault before merge provides the same validation that
Alternative B's second PR was meant to gate.

---

## Consequences

### Positive
- EmbeddingGemma 300M loads without IR version error on all supported platforms.
- WebGPU auto-detect removes manual configuration; WASM fallback is robust
  against session-level failures (not just absence of `navigator.gpu`).
- FORMAT_VERSION 3 with explicit dialog gives users informed consent before
  their index is wiped.

### Negative
- FORMAT_VERSION 2 → 3 forces a full re-index for every user on first load.
  For large vaults with Gemma (190 MB model, 768d vectors) this is a
  non-trivial time cost.
- If Task 1 spike fails, the PR produces only defensive null-guards; the
  IR v10 root cause remains unresolved until the loader issue is worked around
  by another means.
- Bundle size may increase (additional ONNX backends in v4); requires a
  post-build size audit before merge.

### Neutral
- `EmbeddingProvider` interface, `SemanticSearchProvider` interface, and
  `EmbeddingStoreRegistry` are unchanged.
- The DLC concurrency pattern (per-providerKey store isolation, `state.provider`
  pointer swap on rebuild completion) is unchanged.
- The v1 → v2 flat-store migration (`migrateV1FlatStore`) is unchanged; it runs
  before FORMAT_VERSION 3 detection.
- The `onnxruntime-node → onnxruntime-web` redirect in `bun.config.ts` remains
  in place; v4 may use the same detection path (`process.release.name === 'node'`
  in Electron renderer is still true).

---

## Specification: FORMAT_VERSION 2 → 3 migration

The v2 → v3 migration is structurally different from v1 → v2. The v1 → v2
migration was a path rename (flat store → per-providerKey directory) and could
be performed silently because no user data was destroyed (the existing index
was moved, not deleted). The v2 → v3 migration wipes every per-providerKey
store because the vector space is incompatible after the runtime upgrade.

**Sequence at plugin load:**

1. `store.init()` detects `stored.version < FORMAT_VERSION` (i.e., < 3).
2. Before any wipe, `main.ts` raises a blocking `Modal` dialog via
   `IndexWipeMigrationModal` (new, ~30 lines, mirrors `CommandPermissionModal`
   pattern):
   - Title: "Semantic search index must be rebuilt"
   - Body: "The embedding format changed. Your existing index will be deleted
     and rebuilt automatically. This may take several minutes for large vaults."
   - Single button: "Rebuild now" (no cancel — the index is unusable until
     rebuilt; dismiss only delays the next trigger).
3. On user confirmation (or on "dismiss + next trigger"), wipe the
   per-providerKey directory and proceed with a clean init.
4. Start re-indexing in background (existing `startIndexerIfNeeded` hook).
5. The existing re-index banner surfaces progress as it does today.

**Guard condition (store.ts):** `parsed.version !== FORMAT_VERSION` where
`FORMAT_VERSION = 3`. The `parsed.version !== 1` carve-out that existed for v1
stores is dropped — v1 stores were migrated to v2 by `migrateV1FlatStore`;
any remaining v1 stores are treated as stale and wiped.

**Failure path:** If the directory wipe throws (permissions, NFS), log WARN and
surface the re-index banner — same fail-open pattern as `migrateV1FlatStore`.

---

## Specification: WebGPU backend selection

`configureEnv()` in `onnxEnv.ts` probes WebGPU availability at provider init:

```
if (navigator.gpu exists):
  set env for webgpu device
  try:
    load a minimal session probe
  catch any error:
    log WARN "webgpu session init failed, falling back to wasm"
    set env for wasm device
else:
  set env for wasm device
```

The fallback catches session-init errors, not only `!navigator.gpu`. This covers
driver-level crashes that expose `navigator.gpu` but fail on `requestAdapter()`
or ONNX session creation. Logging is at WARN, not ERROR — the fallback is
graceful and the user is not in an error state.

---

## Specification: bun.config.ts changes if Task 1 passes

The `onnxruntime-node → onnxruntime-web` redirect plugin likely remains
necessary (Electron renderer still reports `process.release.name === 'node'`).
Verify whether `@huggingface/transformers` v4 still eager-imports
`onnxruntime-node`; if not, the plugin can be removed.

The CDN `wasmPaths` in `onnxEnv.ts` must be updated from
`onnxruntime-web@1.14.0` to the version bundled with
`@huggingface/transformers` v4. Run `bun pm ls onnxruntime-web` after install
to determine the pinned version and update the CDN URL accordingly.

The `import.meta.url` and `__dirname`/`__filename` defines in `bun.config.ts`
remain in place — they neutralize path resolution that v4 may still perform
at module init even if it no longer breaks the loader.

---

## References

- SPEC.md: `/Users/stefanoferri/Developer/Obsidian_MCP/obsidian-mcp-tools/SPEC.md`
- BRAINSTORM.md: `/Users/stefanoferri/Developer/Obsidian_MCP/obsidian-mcp-tools/BRAINSTORM.md`
- Prior spike record: `embedder.ts` line 199–202 (inline comment, 2026-04-26)
- ADR-0005: multilingual embedding providers (DLC concurrency pattern, provider
  architecture, v2.17.2 pin rationale)
- `onnxEnv.ts`: current env configuration with CDN pin rationale
- `store.ts`: `FORMAT_VERSION`, migration guard, sentinel pattern
- `storeRegistry.ts`: `migrateV1FlatStore`, fail-open pattern
- Issue #202: `.split` crash at query time (downstream symptom, not root cause)
