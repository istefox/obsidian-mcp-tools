# Changelog

All notable changes to **MCP Connector** (formerly `obsidian-mcp-tools`) are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows [Semantic Versioning](https://semver.org/).

## [0.4.0-beta.1] — 2026-04-27

First beta of the 0.4.0 line. Closes Phase 4 of the
HTTP-embedded pivot: migration UX from 0.3.x, three "Copy
config" buttons for the supported MCP client families, opt-in
auto-write of `claude_desktop_config.json`, Node.js detection
+ `mcp-remote` pre-warm, Homebrew-aware install affordances on
macOS.

End-to-end smoke validated in vault TEST + Claude Desktop:
20/20 tools registered, native semantic search returns cosine
matches in the low-ms range, `npx mcp-remote` bridge connects
Claude Desktop to the in-process server (verified across
`list_vault_files`, `search_vault_smart`, `get_vault_file`).

### Added — Migration UX (Phase 4 Block A + C)

- **First-load detector** (`features/migration/services/detect.ts`)
  surfaces three independent signals: legacy
  `installLocation` / `platformOverride` keys in `data.json`,
  orphan `mcp-server` binary at `INSTALL_PATH[platform]`, and
  `claude_desktop_config.json` entries pointing at the binary
  (under either the new `mcp-tools-istefox` key or the legacy
  upstream `obsidian-mcp-tools` key).
- **Migration plan + executor** (`services/plan.ts`) builds the
  list of opt-in steps for the modal: rewrite Claude Desktop
  config, delete the legacy binary, prune the legacy keys.
  Each step is independent — a failure in one does not skip
  the others.
- **Migration modal** (Svelte) shown at
  `app.workspace.onLayoutReady` if any signal fires AND the
  user has not previously dismissed it.
  `migration.skippedAt` is persisted on dismiss / completion
  so the modal does not re-open on every plugin load.
- **`updateClaudeDesktopConfig`** rewrites the entry to the
  0.4.0 shape (`{ command: "npx", args: ["-y", "mcp-remote",
  ..., "--header", "Authorization: Bearer …"] }`), backs up
  to `<configPath>.backup`, removes the legacy
  `obsidian-mcp-tools` key, refuses to overwrite malformed
  JSON.

### Added — Client config UI (Phase 4 Block B)

- **Three "Copy config" buttons** under "Quick setup for clients":
  Claude Desktop (`npx mcp-remote` bridge), Claude Code
  (`{ type: "http", … }`), and a generic streamable-http
  payload for Cursor / Cline / Continue / Windsurf / VS Code.
- **Auto-write Claude Desktop config** opt-in toggle (default
  OFF). When ON, the plugin keeps
  `claude_desktop_config.json` in sync on token rotation /
  port change, with `.backup` written before each rewrite.
- Bearer-token field with Show / Copy / Regenerate; rotation
  invalidates the in-process transport and restarts it
  immediately so the new token takes effect on the next request.

### Added — Claude Desktop integration UX (Phase 4 Block D)

- **Node.js detection** with launchctl-PATH fallback. macOS
  Obsidian launched from Finder/Spotlight inherits a minimal
  PATH that does not include `/opt/homebrew/bin` (Apple
  silicon) or `/usr/local/bin` (Intel) — plain
  `node --version` then ENOENTs even when Node IS installed.
  The detector now scans canonical absolute paths in addition
  to PATH-based lookup, on macOS, Linux, and Windows.
- **Homebrew detection** + one-click "Install via Homebrew"
  button (macOS) when Node is not on PATH but `brew` is
  available. Streams `brew install node` progress lines into
  the UI.
- **`mcp-remote` pre-warm**: runs `npx -y mcp-remote@latest`
  once via the absolute npx path derived from the detected
  Node, with the Node bin dir prepended to the child env
  PATH so npx's shebang `env node` lookup succeeds. Treats
  `mcp-remote`'s own `ERR_INVALID_URL` error as success
  (the package downloaded into `~/.npm/_npx/<hash>` — the
  goal of the pre-warm).

### Changed — Phase 4 cleanup

- The 0.3.x install surface
  (`mcp-server-install/components/McpServerInstallSettings.svelte`)
  is no longer mounted in 0.4.0 settings. The module remains
  in the tree for rollback safety; T14 (stable cut) retires
  it for good.
- Local REST API is now treated as **optional**: a missing
  LRA logs at debug level instead of showing the misleading
  "required" Notice. `search_vault` (DQL / JsonLogic) is the
  only LRA-dependent tool; it returns an actionable error
  to the MCP client when LRA is not installed. The other 19
  tools work without LRA.
- The three legacy LRA endpoint registrations
  (`/search/smart`, `/templates/execute`,
  `/mcp-tools/command-permission/`) are no longer mounted
  — they were callbacks the 0.3.x binary used; in 0.4.0 the
  in-process MCP server calls Obsidian APIs directly.

### Continuous integration

- New `.github/workflows/ci.yml` runs `bun run check` +
  per-package `bun test` on every push to `main` and
  `feat/http-embedded`, plus on every PR targeting either
  branch. Cancels in-flight runs for the same ref when a new
  push lands.
- `release.yml` simplification (drop `mcp-server`
  cross-platform binary jobs) deferred to 0.4.0 stable cut so
  the protected 0.3.x hotfix line is not affected.

### Known limitations carried into beta

- `Disabled MCP tools` (toolToggle) UI persists the list but
  does not gate the registry in 0.4.0 (the binary's
  env-var-based filter is gone). Tools cannot be disabled
  client-side yet; tracked as a follow-up post-stable.
- README rewrite (drop 0.3.x sections, screenshot the
  migration modal) and CHANGELOG collapse of the alpha entries
  are deferred to 0.4.0 stable cut so the alpha → beta diff
  stays reviewable.

### Tests

528+ unit + integration tests pass:
- 87 across `features/migration/` and
  `features/mcp-client-config/` (new in Phase 4).
- 451 pre-Phase-4 baseline (feature parity with 0.4.0-alpha.4).

### References

- Plan: `docs/plans/0.4.0-phase-4-migration-and-store.md`
- Design: `docs/design/2026-04-24-http-embedded-design.md`

## [0.4.0-alpha.4] — 2026-04-26

### Fixed — native semantic search provider works in Electron renderer

- **`search_vault_smart` with `provider="native"` no longer fails with
  `Cannot read properties of undefined (reading 'create')`.** Closes the
  known limitation documented in 0.4.0-alpha.3.

  Root cause: Transformers.js v2.17.2's `backends/onnx.js` selects
  `onnxruntime-node` whenever `process?.release?.name === 'node'`. In
  Electron the renderer process **inherits** `process.release` from the
  main Node process, so this check is **true** even though we're in a
  browser-like environment. The previous bundle stubbed
  `onnxruntime-node` to an empty module, leaving `ONNX.InferenceSession`
  undefined; `from_pretrained` then threw at the first `.create()` call.

  Fix:
  - `bun.config.ts` now **redirects** `onnxruntime-node` resolves to a
    shim that re-exports `onnxruntime-web` (the WASM backend) instead of
    stubbing it empty. Sharp stays stubbed since image pipelines are
    unreachable in our text-only path.
  - `embedder.ts` configures `onnxruntime-web` env on first
    `realPipelineFactory` call: `wasmPaths` pointed at jsdelivr CDN for
    `onnxruntime-web@1.14.0` (works around Bun CJS not preserving
    `import.meta.url` for `.wasm` sibling resolution); `numThreads = 1`
    (Electron renderer lacks COOP/COEP, so SharedArrayBuffer is
    restricted and the worker spin-up path is unsafe);
    `allowLocalModels = false`; `useBrowserCache = true`.

  Verified end-to-end in vault TEST: `search_vault_smart` with
  `provider="native"` returns 11 semantic matches (cosine score
  0.39-0.47) in 15 ms after first cold load. Model is cached in the
  browser Cache API so subsequent reloads skip the download.

### Cosmetic — ONNX runtime warning at first cold load

- A non-fatal `Unable to determine content-length from response headers.
  Will expand buffer when needed.` warning may appear in DevTools
  console on the first model download. It comes from `onnxruntime-web`'s
  internal XHR loader: HuggingFace serves the model via a 302 redirect
  to a CAS bridge (`cas-bridge.xethub.hf.co`) that does not always
  include `Content-Length` for chunked responses. The loader recovers
  by using an expandable buffer — search results are unaffected. Only
  visible at first cold load; subsequent loads hit the cache.

### Notes for upgrades from 0.4.0-alpha.3

- No data migration. The native model is downloaded the first time
  `provider="native"` (or `"auto"` without Smart Connections) is
  invoked; ~25 MB MiniLM-L6-v2 + tokenizer, cached in the browser
  Cache API.
- If you stayed on `provider="auto"` with Smart Connections installed,
  nothing changes for you — the auto-router still prefers SC.

### References

- Fix commit: `f9c8e49` (`fix(semantic-search): redirect
  onnxruntime-node to onnxruntime-web in Electron`)
- Plan: `docs/plans/0.4.0-phase-3-semantic-search.md`

## [0.4.0-alpha.3] — 2026-04-26

### Fixed — critical regression in 0.4.0-alpha.2 dispatch

- **`tools/call` returned HTTP 500 after the first request**
  (transport-level failure). The MCP SDK's
  `StreamableHTTPServerTransport` in stateless mode forbids reuse —
  see `webStandardStreamableHttp.js`: "Stateless transport cannot be
  reused across requests. Create a new transport per request." Our
  setup created the transport once at plugin onload and reused it
  across requests, so the second `tools/call` always failed with an
  empty 500 response. The unit and integration tests didn't surface
  it because each test creates a fresh `McpService`. Real-world
  usage (Claude Desktop, manual `curl`, MCP Inspector) all hit the
  bug on the second tool invocation.

  Fix: `createMcpService` now exposes a request handler that builds
  a fresh `McpServer` + `StreamableHTTPServerTransport` per HTTP
  request. The `ToolRegistry` (with all 20 registrations) stays a
  process singleton so the per-request cost is on the order of
  milliseconds. Validated end-to-end against vault TEST with 8
  consecutive `tools/call` invocations — all return HTTP 200 with
  valid JSON-RPC payloads.

  **Anyone using 0.4.0-alpha.2 should upgrade.** alpha.2 was
  effectively unable to handle more than one tool call per plugin
  load.

### Added — Phase 3 (semantic search) — provider tri-state + indexer + UI

The end-to-end pipeline of native semantic search lands. The
`search_vault_smart` tool no longer requires Smart Connections.
Provider, indexer, and UI are all wired; **see Known limitations
below for the one runtime issue still open**.

- **Provider tri-state setting** (design D7): `auto` (default — use
  Smart Connections if installed, otherwise native), `native`
  (always Transformers.js), `smart-connections` (always SC; errors
  actionably if absent).
- **Native provider** backed by `@xenova/transformers` 2.17.2 +
  `Xenova/all-MiniLM-L6-v2` (384-dim). Cosine flat scan with
  vectorized typed-array math. Folder include/exclude filters apply
  before scoring.
- **Smart Connections provider** extracted from the inline tool
  logic into a dedicated module (`services/smartConnectionsProvider.ts`)
  so both providers share the unified `SearchResult` shape.
- **Embedding store** at `<pluginDir>/embeddings.bin` (sequential
  Float32) + `embeddings.index.json` (record metadata + byte
  offsets). Format version 1; mismatch triggers a clean re-index
  with a warning.
- **Live indexer** (default, design D9): subscribes to
  `vault.on('modify'|'create'|'delete')`, debounces per-file edits
  (2s), re-chunks, reuses vectors for chunks whose `contentHash`
  hasn't changed (chunk-delta), drops records on file delete.
- **Low-power indexer** (opt-in): 5-minute interval scan against
  `getMarkdownFiles().mtime`, single batched `store.flush()` per
  cycle.
- **Lazy start** (Q4 design choice): the indexer is constructed at
  plugin onload but not auto-started — it kicks in on the first
  `search_vault_smart` call so plugin boot stays fast and the
  ~25 MB MiniLM download only happens for users who actually use
  semantic search.
- **Settings UI** (`SemanticSettingsSection.svelte`): tri-state
  radio + indexing-mode radio + unload-when-idle toggle + indexed-
  chunk count + Rebuild button.
- **Model download progress** (`ModelDownloadProgress.svelte`):
  progress card during the first-run download (subscribes to a
  `ModelDownloader` state machine — idle → downloading → ready /
  error with retry).
- **Embedder** with LRU query cache (size 32) and unload-when-idle
  timer (60s default). Concurrent first-call dedupes through a
  shared in-flight `Promise<PipelineFn>`.
- **Chunker**: heading-section (H1/H2) split with 512/64-token
  sliding window fallback for over-long sections; frontmatter
  concatenated to the first chunk; sections under 20 tokens
  skipped; SHA-256 content hashing (16 hex chars) for chunk-delta
  detection.
- **123 new unit tests**: chunker (12), embedder (8), store (9),
  native provider (10), smart-connections provider (15),
  provider factory (9), live + low-power indexer (14), tool
  dispatch contract (7), model downloader (7), settings persist
  (12), end-to-end integration (4).

### Changed

- **Bundle stub for `onnxruntime-node` and `sharp`**
  (`bun.config.ts`): a Bun build plugin replaces both with empty
  modules at bundle time. Marking them `external` left literal
  `require("onnxruntime-node")` in `main.js` that Electron's
  renderer cannot resolve at runtime ("Cannot find module
  'onnxruntime-node'", plugin failed to load). The empty-module
  shim lets Transformers.js's runtime detection pick the
  `onnxruntime-web` (WASM) backend, which is the right choice in
  Electron anyway. Bundle: `main.js` 2.2 MB → 2.9 MB (+700 KB).
- **`search_vault_smart` output shape** (breaking vs alpha.2):
  `{ path, score, breadcrumbs, text }` → `{ filePath, heading,
  excerpt, score }`. The unified `SearchResult` shape is the same
  whether the backend is Smart Connections or the native provider.
- **`SemanticSearchState` shape**: optional `chooser`,
  `downloader`, `indexer`, `store`, `startIndexerIfNeeded` fields
  are now exposed for the settings UI to read live state. Wired by
  `main.ts` against the actual `app.vault` adapter.

### Known limitations

- **Native provider model load fails in Electron WASM path**:
  `search_vault_smart` with `provider="native"` (or `"auto"`
  without Smart Connections installed) returns
  `Semantic search failed: Cannot read properties of undefined
  (reading 'create')` on the first call. Console shows
  `Something went wrong during model construction (most likely a
  missing operation). Using wasm as a fallback.` followed by the
  TypeError inside `from_pretrained`. Transformers.js initializes
  ONNX runtime web in the Electron renderer but the WASM model
  construction throws before completing. Workaround for now: keep
  Smart Connections installed and use `provider="auto"` (the
  default) — it routes to SC and works fine. The native path will
  be fixed in 0.4.0-alpha.4 (likely needs a different ONNX runtime
  init flow or a switch to the `@huggingface/transformers` v3
  successor that ships pure-WASM by default).
- All other 19 tools work end-to-end; this is an isolated Phase 3
  surface issue, not a regression from alpha.2.

### Testing summary

- 453 unit + integration tests pass (351 pre-Phase-3 baseline +
  102 new in Phase 3).
- End-to-end vault TEST smoke: 19/20 tools verified via `curl`
  against the live in-process MCP server. The dispatcher, transport,
  tool registry, command-permissions, vault I/O, fetch, and
  templater integrations all confirmed working.
- The SDK transport reuse bug (alpha.2 critical) was caught by this
  smoke and fixed before alpha.3 release.

### References

- Plan: `docs/plans/0.4.0-phase-3-semantic-search.md`
- Design: `docs/design/2026-04-24-http-embedded-design.md`
  § Semantic search (D7-D9)
- Smoke runbook: `handoff.md` § F "Test 0.4.0-alpha in Obsidian"

## [0.4.0-alpha.2] — 2026-04-25

### Added — Phase 2 tool migration (HTTP-embedded pivot)

Feature parity with `0.3.7` is reached: all 20 tools now run inside the
Obsidian plugin process and respond over the Streamable HTTP transport
introduced in `0.4.0-alpha.1`. No external binary, no Local REST API
required for the core path.

- **14 vault tools** (`get_active_file`, `update_active_file`,
  `append_to_active_file`, `patch_active_file`, `delete_active_file`,
  `show_file_in_obsidian`, `list_vault_files`, `get_vault_file`,
  `create_vault_file`, `append_to_vault_file`, `patch_vault_file`,
  `delete_vault_file`, `search_vault_simple`, plus `search_vault`
  which gracefully degrades to Local REST API when installed)
  migrated to native Obsidian API calls (`app.vault.*`,
  `app.workspace.*`, `app.metadataCache.*`, `app.fileManager.*`).
- **2 command tools** (`list_obsidian_commands`,
  `execute_obsidian_command`) migrated; the existing
  `command-permissions` policy module (deny-by-default, two-phase
  mutex, soft rate limit, presets) is preserved intact.
- **1 web tool** (`fetch`) migrated to use Obsidian's `requestUrl`
  instead of Node `fetch` — the community-plugin ESLint rule that
  previously required a `/skip` exemption is now satisfied.
- **1 template tool** (`execute_template`) bypasses Local REST API
  and calls Templater's API directly via the plugin's existing
  `loadTemplaterAPI` reactive loader.
- **1 semantic tool** (`search_vault_smart`) bypasses Local REST API
  and calls Smart Connections directly via the plugin's existing
  `loadSmartSearchAPI` reactive loader. v2 (`window.SmartSearch`)
  and v3+ (`smartEnv.smart_sources`) backends both supported.

### Fixed
- **`fetch` schema crashed `tools/list`** — the `url` field used
  ArkType's `string.url` shorthand, which is implemented as a
  `predicate: isParsableUrl`. Predicates are not convertible to
  JSON Schema, so `registry.list()` threw on the per-tool
  `.toJsonSchema()` call and the MCP SDK swallowed the error,
  responding with `tools: []`. Schema relaxed to `"string"`; URL
  validity is enforced at runtime by `requestUrl()` and the
  existing handler try/catch. Same pattern as the 0.3.x
  `mcp-server` schema.

### Changed
- `RegisterToolsContext` carries `app: App` and
  `plugin: McpToolsPlugin` references so handlers receive the
  context they need without globals.
- Mock runtime (`src/test-setup.ts`) extended with in-memory
  vault, workspace, metadata, file manager, commands, and
  `requestUrl` plumbing — `mockApp()`, `mockPlugin()`,
  `setMockFile()`, `setMockMetadata()`, `setMockCommands()`,
  `setMockRequestUrl()`, `getExecutedCommands()`,
  `resetMockVault()`.
- `services/patchHelpers.ts` extracted as a shared module for
  `patch_active_file` and `patch_vault_file` — heading path
  resolution, append-body normalization, block lookup against
  `metadataCache.blocks`.

### Known limitations remaining
- No native semantic search yet — Phase 3 will add MiniLM
  embeddings with a tri-state setting (native / Smart Connections
  / auto).
- No migration UX for 0.3.x users yet (Phase 4).
- No per-client "Copy config" generators yet (Phase 4).
- Local REST API still required for `search_vault` (DQL/JsonLogic);
  the dependency becomes optional only when Phase 3 lands the
  native semantic search.
- Manual smoke test in a real vault not yet logged for this alpha.

### Testing summary

351 unit + integration tests pass across the plugin (up from 244 in
`alpha.1`). End-to-end `mcpServer.test.ts` confirms `tools/list`
exposes `get_server_info` plus the 19 ported tools, and `tools/call`
dispatches to each registered handler.

### References

- Plan: `docs/plans/0.4.0-phase-2-tool-migration.md`
- Design: `docs/design/2026-04-24-http-embedded-design.md`
- Manual smoke runbook: `handoff.md` § F "Test 0.4.0-alpha in
  Obsidian"

## [0.4.0-alpha.1] — 2026-04-24

### Added — Phase 1 infrastructure foundation (HTTP-embedded pivot)

First alpha of the 0.4.0 architecture: the plugin now hosts an
in-process HTTP MCP server. No external binary. Not yet a drop-in
replacement for 0.3.x — only one tool (`get_server_info`) is
registered. Tool migration lands in 0.4.0-alpha.2 (Phase 2).

- **Streamable HTTP transport** (MCP spec 2025-06-18) on
  `127.0.0.1:27200` (fallback 27201-27205). Bind is loopback only.
- **Middleware chain**: method/path allow-list (POST/GET on `/mcp`
  and `/mcp/*`), Origin validation against loopback regex
  (anti-DNS-rebinding per spec), Bearer token auth with
  `crypto.timingSafeEqual` (UTF-8 byte-length safe).
- **Bearer token** generated at first load, persisted in
  `data.json` at `mcpTransport.bearerToken`. Rotatable from
  Settings → MCP Connector → Access Control.
- **`ToolRegistry` ported** from `packages/mcp-server` to
  `packages/obsidian-plugin/src/features/mcp-transport/services/`.
  Same ArkType-based registration, same error formatting. 17
  existing tests migrated 1:1.
- **Smoke tool `get_server_info`** returns plugin version +
  transport identifier. Useful to verify the chain end-to-end with
  `bun run inspector` or `curl`.
- **Plugin lifecycle integration**: `onload` starts the HTTP
  server and MCP service; `onunload` tears down cleanly. Start
  failure surfaces as an Obsidian Notice and logs via the shared
  logger; the rest of the plugin loads anyway.
- **Settings UI — Access Control section**: password-style token
  field with Show/Hide/Copy/Regenerate. Regenerate prompts for
  confirm, rotates the token, restarts the transport.

### Known limitations

- Only `get_server_info` is reachable via MCP. The 19 vault tools
  land in 0.4.0-alpha.2.
- No per-client "Copy config" helpers yet (Phase 4).
- No semantic search yet (Phase 3).
- Migration modal for 0.3.x users lands in Phase 4.
- No automated UI tests; the settings component is smoke-tested
  manually via `bun run link` into a test vault.

### Testing summary

244 unit + integration tests pass across the plugin. Middleware
chain, auth primitives, origin validation, port fallback, HTTP
server lifecycle, and MCP tool registration all covered. Manual
end-to-end with MCP Inspector / Claude Code pending as the first
community smoke test on this alpha.

### References

- Design: `docs/design/2026-04-24-http-embedded-design.md`
- Phase 1 plan: `docs/plans/0.4.0-phase-1-infrastructure.md`
- Upstream context: jacksteamdev/obsidian-mcp-tools#79
- Installer regression fixed in the same cycle: #3

## [0.3.7] — 2026-04-24

### Fixed
- **`patch_active_file` / `patch_vault_file` block-in-table silent
  corruption** — `Create-Target-If-Missing` now defaults per target
  type: `true` for `heading` and `frontmatter` (upstream 0.2.x compat,
  unchanged), `false` for `block`. `markdown-patch`'s block indexer
  does not search inside markdown table cells, so a block `^id` sitting
  in a cell was unresolvable; under the previous single `true` default,
  the Local REST API silently appended the caller's `content` at EOF
  and returned HTTP 200. Retries compounded the damage. Block targets
  now fail loud on unresolved ids so callers can decide the recovery
  path explicitly. Heading + frontmatter behavior is preserved.
  Closes the block-in-table half of upstream issue #71 (heading half
  was fixed in 0.3.0); reported by @folotp.

### Changed
- Updated the JSDoc on `ApiPatchParameters.createTargetIfMissing` and
  the runtime `.describe()` string so model callers see the new
  per-target-type default contract.
- Added 6 regression tests in `patchVaultFile.test.ts` pinning the
  per-target-type defaults (block → false, heading → true,
  frontmatter → true) against accidental regression, plus opt-in
  overrides for block targets (explicit `true` and `false`) and
  heading-target strict-mode (explicit `false`).

## [0.3.6] — 2026-04-24

### Fixed
- `get_vault_file(format: "json")` failed ArkType validation on any
  note whose frontmatter contained a list-valued key — `aliases`,
  `tags`, `up`, `down`, `next`, `previous`, `cssclasses`, etc. are
  routinely arrays in Obsidian Flavored Markdown. The `ApiNoteJson`
  schema declared `frontmatter: Record<string, string>`, so Local
  REST API's correct array payload was rejected at the wrapper
  boundary with `frontmatter.aliases must be a string (was an
  object)`, making the `json` format effectively unusable on
  realistic vaults. Widened the shape to `Record<string, unknown>`
  to match YAML/OFM semantics. Added 7 regression tests in
  `plugin-local-rest-api.test.ts` covering the canonical aliases
  repro, the full OFM convention set (aliases + tags + up + down +
  next + previous + cssclasses), mixed scalar+array frontmatter,
  non-string scalars (number, boolean, null), nested mapping
  values, empty frontmatter, and a sanity check that the top-level
  schema was not incidentally widened. Fixes upstream issue #81,
  diagnosed by @folotp.

## [0.3.5] — 2026-04-23

### Fixed
- **"Install Server" returned 404 on every platform since the fork** —
  `packages/obsidian-plugin/bun.config.ts` hardcoded a `define` entry
  for `process.env.GITHUB_DOWNLOAD_URL` pointing at
  `jacksteamdev/obsidian-mcp-tools/releases/download/<version>`. The
  `define` ran at bundle time and silently overrode the
  `GITHUB_DOWNLOAD_URL` env var injected by `.github/workflows/release.yml`,
  so every shipped `main.js` looked for `mcp-server-windows.exe` (and
  the macOS/Linux equivalents) on the dormant upstream repo where the
  fork versions do not exist. Switched the `define` to read
  `process.env.GITHUB_DOWNLOAD_URL` at build time with a
  fork-repo fallback for local builds. Same treatment for
  `GITHUB_REF_NAME`. The build-time ArkType macro in
  `features/mcp-server-install/constants/bundle-time.ts` now receives
  the correct values in CI. Reported in #3.

## [0.3.4] — 2026-04-21

### Added
- `get_vault_file` now returns native MCP `image` and `audio` content
  blocks for supported binary types (PNG, JPEG, GIF, WebP, SVG, BMP,
  MP3, WAV, OGG, M4A, FLAC, AAC, WebM audio), so multimodal clients
  can render them inline instead of receiving an opaque base64 blob
  in a text response. Files above a 10 MiB inline cap, plus unsupported
  types (video, PDF, Office, archives), still get a JSON metadata
  object with the same API path / MIME fields as before, and a
  machine-readable `hint` describing why the body was not inlined.
  Builds on the 0.3.0 short-circuit for #59; lifts the text-only
  fallback now that SDK 1.29.0 ships native binary content types.

### Changed
- Widened the `ToolRegistry` result schema to accept `audio` content
  blocks alongside `text` and `image`, matching MCP SDK 1.29.0.
- Added `makeBinaryRequest` in `shared/makeRequest.ts` for the new
  binary code path — reuses the same auth and path-normalization
  layer as `makeRequest` but returns raw bytes plus the upstream
  `Content-Type` header instead of decoding as text/JSON.

## [0.3.3] — 2026-04-21

### Added
- `OBSIDIAN_API_URL` env var support as a convenience alias that
  parses into host / port / protocol. The more specific
  `OBSIDIAN_HOST`, `OBSIDIAN_PORT` and `OBSIDIAN_USE_HTTP` variables
  still take precedence when set, preserving drop-in compatibility
  with upstream v0.2.x configurations. Fixes upstream issue #66.

### Fixed
- `normalizeInputSchema` now strips `additionalProperties: {}` (the
  empty-object form emitted by some schema generators), which
  strict MCP validators such as Letta Cloud reject with a 500.
  `additionalProperties: true`, `false`, and genuine sub-schemas are
  left untouched. Fixes upstream issue #63.
- `makeRequest` collapses consecutive slashes in request paths, so a
  caller-supplied directory with a trailing slash (`"DevOps/"`) no
  longer produces `/vault/DevOps//` and the subsequent 404 from the
  Local REST API. Fixes upstream issue #37.

### Changed
- Extracted `buildPatchHeaders` and `normalizeAppendBody` from the
  `patch_active_file` / `patch_vault_file` handlers as pure helpers,
  and added regression tests for the URL-encoded `Target` header
  (Cyrillic, CJK, accented + bracketed strings) and the trailing-
  newline safeguard on `append`. No behavior change — this pins
  the 0.3.0 fixes for upstream issues #30, #71, and #78 against
  accidental regression.
- Extended the regression-test pin to cover three additional 0.3.0
  fixes that were landed but never credited or test-covered:
  client-side `limit` truncation on `search_vault_simple` (#62),
  the optional `certificateInfo` / `apiExtensions` shape on the
  Local REST API root response (#68), and the optional
  `frontmatter.tags` on `ApiVaultFileResponse` that unblocks
  `execute_template` for tagless Templater templates (#41).
  Extracted `applySimpleSearchLimit` as a pure helper for symmetry
  with the other patch-handler extracts. No behavior change.
- Audit pass over the 2026-04-11 cluster commits surfaced nine
  additional upstream issues that were fixed during the 0.3.0 cut
  but never credited in the CHANGELOG: #39 (`search_vault_smart`
  Content-Type), #61 (disable individual tools via env var + UI),
  #59 (binary-file short-circuit in `get_vault_file`), #35 + #60
  (non-Claude-Desktop MCP client docs), #28 (install outside the
  vault), #26 (platform override for binary selection), #31 + #36
  (Linux installer path handling), #40 + #67 (configurable Local
  REST API port). Credit entries added below under `0.3.0 Fixed`
  with commit SHAs. No behavior change — the fixes have been in
  production since 2026-04-11.
- Added a regression pin for issue #39: the `search_vault_smart`
  tool handler now has a test asserting the explicit
  `Content-Type: application/json` header survives future refactors.
  The plugin-side `/search/smart` endpoint only parses bodies whose
  Content-Type matches `application/json`; losing the header would
  silently reintroduce the "semantic search returns no results"
  failure mode. No behavior change.

## [0.3.2] — 2026-04-17

### Changed
- Migrated the MCP server from the deprecated `Server` class to `McpServer` (SDK 1.29.0 high-level API). The underlying `Server` is still reachable via `McpServer.server` for the low-level `setRequestHandler` routing used by the custom `ToolRegistry`.
- Sentence-case pass on user-facing `Notice` text.

### Fixed
- Lint pass over the `ObsidianReviewBot` findings across all three packages (plugin, shared, MCP server):
  - typed error stringification (`error instanceof Error ? error.message : String(error)`) on every template-literal fallback;
  - `void`-prefixed fire-and-forget Svelte `mount`/`unmount` and `bun:test` `mock.module` calls;
  - removed useless `async` on `setup()` helpers and `getLocalRestApiKey`; added `.catch()` handler on the RxJS `lastValueFrom` in `main.ts`;
  - removed `any` from the Smart Connections v2/v3 compatibility wrapper via minimal inline types (both code paths preserved);
  - replaced the workspace self-import in `packages/shared` with a relative path;
  - miscellaneous cleanups: `String.raw` regex literal, `parseInt` radix, unused catch bindings, unused imports, empty-object types tightened.

## [0.3.1] — 2026-04-13

### Fixed
- Trimmed the `manifest.json` description to satisfy community-store reviewer-bot rules (removed the `Obsidian` token, aligned with the description used in `community-plugins.json`).

## [0.3.0] — 2026-04-13

### Added
- Rebrand to **MCP Connector** (`id: mcp-tools-istefox`, author: Stefano Ferri). The fork is now publicly published as `istefox/obsidian-mcp-connector`.
- Issue #29 command-execution feature set: per-vault allowlist + confirmation modal + audit log + presets, all gated by a master toggle (disabled by default). See `docs/design/issue-29-command-execution.md` for the full threat model.
- End-user README rewrite covering installation, configuration, MCP-client compatibility, security posture, and development workflow.
- Migration guide for users switching from upstream (`docs/migration-from-upstream.md`).

### Fixed
- `bun run version <part>` now reads the semver part from the correct argv index (was always falling back to `patch`).
- Release pipeline paths corrected so the cross-platform build workflow produces the expected artifacts.
- Upstream issue #77 regression: tools with `arguments: {}` now emit `inputSchema` with an explicit `properties` key — fixes strict MCP clients such as `openai-codex`.
- Smart Connections v3 compatibility (the wrapper now handles both `window.SmartSearch` in v2.x and `env.smart_sources` in v3+).
- `patch_active_file` / `patch_vault_file`: resolve partial heading
  names to full hierarchical paths (e.g. `"Section A"` →
  `"Top Level::Section A"`) before issuing the PATCH, preventing
  silent content corruption when the target sits under a parent
  heading. Fixes upstream issues #30 and #71. (Shipped in the
  0.3.0 cut via commit `d75e493`; credited retroactively here.)
- `patch_active_file` / `patch_vault_file`: URL-encode the `Target`
  and `Target-Delimiter` HTTP headers so non-ASCII heading names
  (Cyrillic, CJK, emoji, accented characters) survive the HTTP
  header grammar. Encoding happens after path resolution so the
  indexer lookup still matches unencoded file content. Fixes
  upstream issue #78.
- `patch_active_file` / `patch_vault_file`: append content is now
  normalized to end with `\n\n` so subsequent sections remain
  visually separated instead of colliding (e.g. `**done**## Next`).
- New `createTargetIfMissing` parameter on both patch tools lets
  callers opt into strict mode (return an explicit error instead
  of silently creating a new target at EOF when the lookup fails).
  Defaults to `true` for upstream compatibility.
- `search_vault_simple`: added an optional `limit` parameter that
  truncates the result array client-side (the underlying Local
  REST API `/search/simple/` endpoint has no native `limit` flag,
  so we slice after receiving the response). Prevents context-
  window overflow on common terms that match thousands of files,
  which otherwise forces MCP clients into the "tool result stored
  to a file" fallback and breaks conversational flow. Fixes
  upstream issue #62. (Shipped in the 0.3.0 cut via commit
  `539e115`; credited retroactively here.)
- `ApiStatusResponse`: `certificateInfo` and `apiExtensions` are
  now optional on the Local REST API `GET /` root response. The
  plugin emits them only when the caller is authenticated, so
  the MCP server's startup probe (which runs before auth is in
  place for some flows) must still accept the trimmed body —
  hard-requiring them made every MCP tool call fail with an
  ArkType validation error on Local REST API v3.4.x. Fixes
  upstream issue #68. (Shipped in the 0.3.0 cut via commit
  `92b233c`; credited retroactively here.)
- `ApiVaultFileResponse`: `frontmatter.tags` is now optional.
  Obsidian emits the `tags` key only when the note's YAML
  frontmatter actually declares one — very common for Templater
  templates and freshly-created notes to lack it. The previous
  hard requirement surfaced as `frontmatter.tags must be an
  array (was null)` and broke `execute_template` and prompt
  loading. Fixes upstream issue #41. (Shipped in the 0.3.0 cut
  via commit `0b39524`; credited retroactively here.)
- `search_vault_smart`: explicit `Content-Type: application/json`
  header on the POST to `/search/smart`. The default Content-Type
  inherited from `makeRequest` is `text/markdown` (correct for
  file-content endpoints, wrong for JSON-body endpoints); Express's
  `bodyParser.json()` only parses bodies with an `application/json`
  Content-Type, so the plugin handler was seeing an empty `req.body`
  and rejecting every semantic search. Fixes upstream issue #39.
  (Shipped in the 0.3.0 cut via commit `0b39524`; credited
  retroactively here.)
- New `OBSIDIAN_DISABLED_TOOLS` env var and plugin settings UI
  let users opt out of specific MCP tools by name (comma-separated
  list). Unknown names log warnings but do not abort startup. The
  plugin-side UI writes the env var into
  `claude_desktop_config.json` automatically so GUI-only users
  don't have to hand-edit their MCP client config. Fixes upstream
  issue #61. (Shipped in the 0.3.0 cut via commits `7ba5f3a` +
  `7733bd8`; credited retroactively here.)
- `get_vault_file` on a binary file (audio, image, video, PDF,
  Office, archive) used to crash or return UTF-8-corrupted bytes.
  It now short-circuits on binary filenames and returns a
  structured `{ kind: "binary_file", mimeType, hint }` payload
  directing the caller to `show_file_in_obsidian`. Extension-based
  detection against ~45 common binary extensions; textual formats
  (md, json, yaml, html, csv, txt, svg) remain on the normal read
  path. Fixes upstream issue #59. (Shipped in the 0.3.0 cut via
  commit `f6d004a`; credited retroactively here. Native SDK 1.29.0
  audio/image responses are a separate follow-up.)
- README documents setup for non-Claude-Desktop MCP clients
  (Claude Code, Cline, Continue, Zed, generic clients) with
  per-platform binary paths, the full env var table, and a
  generic `mcpServers` config template. Fixes upstream issues #35
  and #60. (Shipped in the 0.3.0 cut via commit `aa1697a`;
  credited retroactively here.)
- Install-location flexibility: users can now install the MCP
  server binary outside the vault (the new default, placed under
  the standard per-user application directory) or opt into the
  legacy in-vault layout. A migration banner detects existing
  in-vault binaries and offers a one-click move to the system
  path, preserving the Claude Desktop config entry. Fixes upstream
  issue #28. (Shipped in the 0.3.0 cut via commits `4552c18` +
  `ce8a4bd`; credited retroactively here.)
- Platform override for server-binary selection via an Advanced
  setting in the plugin UI and `OBSIDIAN_SERVER_PLATFORM` /
  `OBSIDIAN_SERVER_ARCH` env vars. Needed when Obsidian is running
  under WSL, Bottles, wine, or another translation layer where
  the auto-detected OS/arch does not match the client that will
  launch the binary. Invalid values fall through to auto-detect
  rather than throwing. Fixes upstream issue #26. (Shipped in the
  0.3.0 cut via commit `2121ecf`; credited retroactively here.)
- Linux installer path handling: POSIX-vs-Win32 absoluteness check
  order corrected so a leading `/` is no longer mis-identified as
  a Win32 drive root; the Claude Desktop Linux config path now
  uses the correct capital-`C` / full filename
  (`~/.config/Claude/claude_desktop_config.json`); and
  realpath-induced duplicate path segments (common on iCloud
  Drive / symlinked vault layouts) are collapsed before the
  filesystem check. Fixes upstream issues #31 and #36. (Shipped
  in the 0.3.0 cut via commit `67637f4`; credited retroactively
  here. The same commit also addressed #37, credited separately
  under 0.3.3.)
- `OBSIDIAN_PORT` env var and `--port <value>` / `--port=<value>`
  CLI flag let users point the MCP server at a non-default Local
  REST API port. Precedence chain (highest first): CLI flag > env
  var > protocol default (27124 HTTPS, 27123 HTTP). Needed for
  multi-vault setups, WSL, and security-hardened deployments.
  Fixes upstream issues #40 and #67. (Shipped in the 0.3.0 cut
  via commit `04765b9`; credited retroactively here.)

## Earlier

Release history before the community-continuation rebrand lives in the upstream repository at
[`jacksteamdev/obsidian-mcp-tools`](https://github.com/jacksteamdev/obsidian-mcp-tools) up to `0.2.27`.

[0.3.3]: https://github.com/istefox/obsidian-mcp-connector/releases/tag/0.3.3
[0.3.2]: https://github.com/istefox/obsidian-mcp-connector/releases/tag/0.3.2
[0.3.1]: https://github.com/istefox/obsidian-mcp-connector/releases/tag/0.3.1
[0.3.0]: https://github.com/istefox/obsidian-mcp-connector/releases/tag/0.3.0
