# SPEC: Multilingual embedding providers for search_vault_smart

## Objective

Replace the single hardcoded `all-MiniLM-L6-v2` backend with a pluggable
`EmbeddingProvider` interface and add two multilingual local providers:
**EmbeddingGemma 300M** (Apache 2.0, 768d, Matryoshka, 2K context) and
**multilingual-e5-base** (MIT, 768d, 512 context). Bundle a markdown-aware
chunker upgrade that benefits all providers including the existing native one.

## Scope

**In scope — this cycle:**
- `EmbeddingProvider` interface and refactor of existing backends behind it
- EmbeddingGemma 300M ONNX provider (task-prompt aware: `"task: search result | query: {text}"` / `"title: none | text: {text}"`)
- multilingual-e5-base provider (`"query: "` / `"passage: "` prefixes)
- Store path keyed on `providerKey` (`embeddings/<providerKey>/`)
- Provider-change banner + explicit re-index button in settings
- Model files cached to `.obsidian/plugins/mcp-connector/models/<modelId>/`
- Markdown-aware chunker: frontmatter chunk, H2 split, code fence atomic, 1-sentence overlap
- Progress UI for model download (reuse existing `ModelDownloadProgress.svelte` pattern)
- Settings UI: radio group extended with new provider entries

**Out of scope — deferred:**
- Gemini cloud provider (Option B) — separate chain
- Matryoshka dimension selection (fixed at 768 for EmbeddingGemma and e5-base)
- HNSW approximate-nearest-neighbour index (flat scan retained, per existing design)
- Cross-vault or cross-device index sharing

## Stack

- **Runtime:** `@huggingface/transformers` (already in tree) with `device: 'wasm'` explicit (Electron compatibility)
- **Settings UI:** Svelte (existing `SemanticSettingsSection.svelte`)
- **Store format:** existing `embeddings.bin` + `embeddings.index.json` (one pair per provider under `embeddings/<providerKey>/`)
- **Test harness:** bun test (existing)

## Architecture

### EmbeddingProvider interface

New in `features/semantic-search/types.ts`:

```
interface EmbeddingProvider {
  readonly providerKey: string      // stable id: "native-minilm-l6-v2" | "embedding-gemma-300m" | "multilingual-e5-base"
  readonly dimensions: number       // 384 or 768
  readonly maxInputTokens: number   // 512 or 2048
  embed(texts: string[], role: "document" | "query"): Promise<Float32Array[]>
  isAvailable(): Promise<boolean>
  getModelSizeBytes(): number       // approximate; drives UI estimate
}
```

### Provider implementations

| File | Model | Key | Dims | Context | License |
|---|---|---|---|---|---|
| `nativeProvider.ts` (refactored) | all-MiniLM-L6-v2 | `native-minilm-l6-v2` | 384 | 512 | Apache 2.0 |
| `embeddingGemmaProvider.ts` (new) | onnx-community/embeddinggemma-300m-ONNX | `embedding-gemma-300m` | 768 | 2048 | Apache 2.0 |
| `multilingualE5Provider.ts` (new) | Xenova/multilingual-e5-base | `multilingual-e5-base` | 768 | 512 | MIT |

`embeddingGemmaProvider` and `multilingualE5Provider` share a generic
`TransformersProvider` base (parameterized by model id, dims, task-prompt fn).

### Store path strategy

```
.obsidian/plugins/mcp-connector/
  models/
    embedding-gemma-300m-ONNX/     ← downloaded ONNX files
    multilingual-e5-base/
  embeddings/
    native-minilm-l6-v2/           ← existing index (migrated from flat embeddings/)
      embeddings.bin
      embeddings.index.json
    embedding-gemma-300m/
      embeddings.bin
      embeddings.index.json
    multilingual-e5-base/
      embeddings.bin
      embeddings.index.json
```

Existing users: on first load with the new code, the flat `embeddings/` dir is
migrated to `embeddings/native-minilm-l6-v2/` transparently.

### Indexer — provider change detection

`indexer.ts` reads the active provider's `providerKey` from settings on each
init. If the `embeddings/<providerKey>/` dir does not exist, emit a
`providerIndexMissing` event. The settings component listens to this event
and shows the re-index banner.

### Chunker upgrade

All changes are backward-compatible (no API surface change, just richer output):

1. **Frontmatter chunk:** YAML frontmatter block extracted as a separate
   chunk, always prepended before body chunks. Chunk id suffix: `#frontmatter`.
2. **H2-bounded body split:** split on `## Heading` boundaries. If a section
   exceeds `maxInputTokens`, split further on `### Heading`. Never split
   inside a section that fits.
3. **Code fences and tables atomic:** if a code fence or table exceeds
   `maxInputTokens`, keep it as a single oversized chunk (truncation is
   better than mid-fence split). Log a debug warning.
4. **1-sentence overlap:** prepend the last sentence of the previous chunk
   to the next chunk's text before embedding (not stored, applied at embed time).

### Settings schema (additive)

```ts
type SemanticSearchSettings = {
  provider: "native" | "smart-connections" | "auto" | "embedding-gemma" | "multilingual-e5-base"
  indexingMode: "live" | "low-power"
  unloadModelWhenIdle: boolean
}
```

`"embedding-gemma"` maps to `EmbeddingGemmaProvider` (768d).
`"multilingual-e5-base"` maps to `MultilingualE5Provider` (768d).
Existing values `"native"`, `"smart-connections"`, `"auto"` are unchanged.

## Data model

### Model download record (in-memory, not persisted)

```
{ modelId: string, status: "idle" | "downloading" | "ready" | "error", progressBytes: number, totalBytes: number }
```

### Index store (unchanged format, new path)

`FORMAT_VERSION` bumped from 1 → 2. v1 stores found at the flat path are
migrated to `embeddings/native-minilm-l6-v2/` on init; format version stays
1 in the migrated files (content is identical, only the path changes).

## UI flows

### 1. User selects EmbeddingGemma in settings

1. Settings saves new provider value.
2. If `embeddings/embedding-gemma-300m/` does not exist: yellow banner appears below the radio group:
   > "EmbeddingGemma requires a one-time index rebuild (~190 MB model download + re-embedding). Estimated time: 20–40 min depending on vault size. **[Rebuild now]**"
3. User clicks **Rebuild now**:
   - Button changes to a spinner + "Downloading model… 47 MB / 190 MB"
   - On download complete: "Indexing… 234 / 1,204 notes"
   - On completion: banner disappears, search is active.
4. If user closes settings before rebuild: banner re-appears next time settings opens (or on plugin load) until the index exists.

### 2. User switches back to native

Instant — `embeddings/native-minilm-l6-v2/` already exists (migrated on first load).
No banner, no rebuild.

### 3. First load with new plugin version (existing users)

`embeddings/` (flat) detected → silent migration to `embeddings/native-minilm-l6-v2/`.
No UX change. Search works immediately.

## Edge cases

| Scenario | Behaviour |
|---|---|
| Download interrupted mid-file | Partial model file detected (size mismatch); re-download on next "Rebuild now" |
| Re-index triggered while another is running | Queue; second trigger is a no-op, not a parallel run |
| EmbeddingGemma selected but model not yet downloaded | `search_vault_smart` returns `errorCode: "provider_not_ready"` with hint to open settings |
| Vault with 0 markdown notes | Empty index; no crash; `search_vault_smart` returns empty results |
| Frontmatter chunk > maxInputTokens | Kept as single chunk (oversized) and truncated at tokenizer level |
| Code fence > maxInputTokens | Kept atomic, oversized chunk, debug log |
| `device: 'wasm'` unavailable in Electron | Fall back to `device: 'cpu'`; log info; inference works, slower |
| Old index FORMAT_VERSION=1 at flat path | Migrated to providerKey path; version stays 1; normal load |

## Success criteria

- `search_vault_smart` with EmbeddingGemma returns relevant results for French/Italian queries against a multilingual vault
- Selecting EmbeddingGemma shows the re-index banner; clicking "Rebuild now" downloads model, indexes vault, and makes search active
- Selecting native provider after EmbeddingGemma is instant (no re-index)
- Existing users upgrade silently (flat index migrated, search uninterrupted)
- e5-base and EmbeddingGemma appear in the settings provider radio group
- Chunker produces a separate frontmatter chunk and H2-bounded body chunks
- Code fences are never split mid-fence
- All existing semantic search tests pass; new tests cover providers, chunker upgrades, and migration path
- Model files land in `.obsidian/plugins/mcp-connector/models/`
- Gemini option is absent (deferred)
