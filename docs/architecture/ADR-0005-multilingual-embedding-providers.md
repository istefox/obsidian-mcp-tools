# ADR-0005: Multilingual embedding providers for `search_vault_smart`

**Status:** Accepted  
**Date:** 2026-05-27

---

## Context

`search_vault_smart` currently uses a single hardcoded `all-MiniLM-L6-v2`
backend (384d, English-dominant). Users with multilingual vaults (French,
Italian, mixed) report poor recall. Two additional local models address this
without cloud dependency:

- **EmbeddingGemma 300M** (`onnx-community/embeddinggemma-300m-ONNX`): 768d,
  2048-token context, Apache 2.0. Task-prompt format: query prefix
  `"task: search result | query: {text}"`, document prefix
  `"title: none | text: {text}"`. Approximate download size ~190 MB.
- **multilingual-e5-base** (`Xenova/multilingual-e5-base`): 768d, 512-token
  context, MIT. Prefix format: `"query: "` / `"passage: "`. Approximate
  download size ~100 MB.

The existing embedding layer (`embedder.ts`, `nativeProvider.ts`,
`providerFactory.ts`) has no provider abstraction. The store writes to a flat
`embeddings/` path keyed to a single 384d vector space. The chunker does not
distinguish frontmatter from body, does not respect H2 section boundaries, and
does not treat code fences as atomic units.

Constraints that shaped the decision:

- `@xenova/transformers` v2.17.2 is pinned (v4 breaks under Obsidian's plugin
  loader; see CLAUDE.md Gotchas). All new providers must work with this version.
- Electron/WASM constraint: `device: 'wasm'`, single-threaded (no
  SharedArrayBuffer). CDN-pinned WASM paths required.
- `FORMAT_VERSION = 1` must not corrupt existing user indices.
- The native MiniLM provider must continue to work without any user action
  (existing users upgrade silently).
- Gemini cloud provider deferred. Matryoshka dimension selection deferred.

---

## Decision

**Adopt Alternative A (SPEC-faithful) with the two BRAINSTORM integrations:
DLC UX and a non-downloading auto-detect banner.**

The full feature set shipped in one PR:

1. `EmbeddingProvider` interface added to `types.ts`.
2. `nativeProvider.ts` refactored behind the interface; unmodified at the
   `SemanticSearchProvider` (search-side) level.
3. A shared `TransformersProvider` base class parameterized by model ID and
   task-prompt function; both `EmbeddingGemmaProvider` and
   `MultilingualE5Provider` extend it.
4. Store paths keyed on `providerKey` (`embeddings/<providerKey>/`).
   `FORMAT_VERSION` bumped to 2; v1 at the flat path silently migrated to
   `embeddings/native-minilm-l6-v2/` on first load.
5. A multi-store registry (`EmbeddingStoreRegistry`) wires one
   `EmbeddingStore` instance per provider key.
6. `indexer.ts` made provider-agnostic: accepts `EmbeddingProvider` and
   `EmbeddingStore` as injected dependencies; the store key is now determined
   by the chosen provider's `providerKey`, not by a hardcoded path.
7. DLC UX: during a new provider's download + index build, the native
   provider's store stays active and continues serving queries. The active
   search provider swaps only when the new index is fully built.
8. `"auto"` mode extended: on first activation, sample ~50 notes and compute
   the non-ASCII character ratio. If >30% non-ASCII, surface a settings banner
   suggesting EmbeddingGemma; no download triggered automatically.
9. Settings schema extended: `provider` union gains `"embedding-gemma"` and
   `"multilingual-e5-base"`.
10. Chunker upgraded: frontmatter as a separate chunk (`#frontmatter` suffix),
    H2-bounded body split with H3 sub-split, code fences and tables kept
    atomic, 1-sentence overlap prepended at embed time.

### Why Alternative A over the other candidates

**Alternative B (e5-base MVP only):** Would ship the interface refactor and one
multilingual model faster, but EmbeddingGemma's 2048-token context window and
Matryoshka architecture are qualitatively different from e5-base and require a
second PR. Two PRs means two migrations, two migration tests, and two UI
additions. The single-PR cost of shipping both simultaneously is lower than the
coordination overhead of sequencing them.

**Alternative C (interface-first, models deferred):** The structural refactor
is valuable on its own, but splitting it from the models defers the user-facing
feature and creates an intermediate state where the interface exists but no new
provider can be selected. The risk of regressions on the native path is
mitigated by the existing test suite and by the DLC design (new providers build
into separate store directories, so a bug there cannot corrupt the native
index).

**Alternative D (full auto-detect):** Ruled out in its full form: auto-download
of ~190 MB without explicit user consent is a hard UX anti-pattern. Retained as
a soft suggestion (banner, no download). Language detection is cheap enough
(50-note sample, character ratio) to not affect plugin load time.

### DLC concurrency model

During a provider rebuild:

- `EmbeddingStoreRegistry` holds both the old (active) store and the
  new (building) store.
- `searchVaultSmartHandler` routes queries to `state.provider`, which still
  points at the old `NativeProvider` backed by the old store.
- The indexer rebuild writes exclusively into the new provider's store
  directory. No lock is needed against the old store because they are
  physically separate paths.
- When `rebuildAll()` completes without error, the registry emits a
  `providerReady` event; `index.ts` swaps `state.provider` to the new
  provider, closes the old store, and persists the new provider key.
- If the rebuild errors mid-way, the new store is left in a partially-built
  state. On next load, the missing/incomplete index for the selected provider
  triggers the re-index banner again; the flat-sentinel mechanism
  (`embeddings.index.json.writing`) already handles mid-flush crashes.

### Chunker upgrade

The existing `chunk()` function is augmented (not replaced):

- Frontmatter is now emitted as a distinct first chunk with id suffix
  `#frontmatter` rather than prepended to the first body chunk. This
  preserves the existing `minTokens` guard.
- Body sections split on H2 boundaries (existing H1 split retained); if a
  section exceeds `maxInputTokens`, split further on H3.
- Code fences (`\`\`\`...`) and pipe-delimited tables detected by a
  simple regex pass; if oversized, kept as a single chunk and logged at
  `debug`. Never split mid-fence.
- 1-sentence overlap: before calling `embed()`, the last sentence of the
  previous chunk is prepended. Not stored in the chunk record; applied
  in a new thin wrapper `wrapWithOverlap(chunker, embed)` inside the indexer.
  The `Chunk` schema is unchanged.

### Matryoshka / variable dimensions

`EmbeddingProvider.dimensions` is typed as `readonly number` so a future
provider can declare variable dimensionality without changing the interface.
The current two new providers fix dimensions at 768. A dimension-selection
slider is explicitly deferred and not wired in this cycle.

---

## Alternatives considered

### Alternative A — SPEC-faithful + DLC UX (adopted)

See Decision above.

### Alternative B — e5-base MVP only

Single multilingual provider (MIT, ~100 MB), EmbeddingGemma deferred.

**Rejected:** Two-phase delivery doubles migration surface and delays the
qualitatively differentiated model (2K context, Matryoshka).

### Alternative C — Interface-first, models in a follow-up PR

Structural refactor in PR 1; both providers in PR 2.

**Rejected:** Produces an intermediate repo state with an unused interface.
The DLC design isolates provider stores, removing the primary regression risk
that motivated this split.

### Alternative D — Full auto-mode with provider auto-selection

`"auto"` detects dominant vault language and selects provider without user
confirmation.

**Rejected in full form:** Silent ~190 MB download violates consent. Retained
as a non-downloading suggestion banner only.

### Rejected idea: bundle e5-base in the plugin binary

~100 MB added to every user's plugin download regardless of language needs.
The Obsidian community store has size constraints; this would likely block
listing. Rejected unconditionally.

---

## Consequences

**Positive:**
- Multilingual vaults (French, Italian, mixed) get meaningfully better recall.
- Zero search blackout during provider switch (DLC UX).
- Existing users upgrade silently; native MiniLM remains default.
- `TransformersProvider` base class means a third provider requires no
  new plumbing, only a `modelId` + task-prompt function.
- Chunker upgrade benefits all three providers uniformly.

**Negative:**
- First-time EmbeddingGemma users face a 190 MB download and 20–40 min
  index build (clearly communicated in the banner; native stays active).
- Three providers to maintain; two index directories per user who has switched.
- `FORMAT_VERSION` migration adds a one-time path rename on upgrade; must
  be covered by an integration test using a real filesystem.
- `main.ts` production wiring grows in complexity (registry, per-provider
  store construction, DLC swap logic).

**Neutral:**
- `EmbeddingStore` interface is unchanged; the registry wraps it.
- `Embedder` interface is unchanged; each provider constructs its own.
- `SemanticSearchProvider` (search-side interface) is unchanged.
- `searchVaultSmartHandler` is unchanged; it addresses `state.provider`.

---

## References

- SPEC.md: `/Users/stefanoferri/Developer/Obsidian_MCP/obsidian-mcp-tools/SPEC.md`
- BRAINSTORM.md: `/Users/stefanoferri/Developer/Obsidian_MCP/obsidian-mcp-tools/BRAINSTORM.md`
- `@xenova/transformers` v2.17.2 pin rationale: `embedder.ts` file header
- WASM CDN pin: `embedder.ts` `ORT_WASM_PATHS` constant (onnxruntime-web@1.14.0)
- DLC concurrency: see `EmbeddingStoreRegistry` design in the implementation plan
- Matryoshka future option: `EmbeddingProvider.dimensions` is typed `readonly number`
  precisely to accommodate variable-dim providers without interface churn
