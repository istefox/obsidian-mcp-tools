# Changelog

All notable changes to **MCP Connector** (formerly `obsidian-mcp-tools`) are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- **Default `createTargetIfMissing: false` for `targetType: "heading"`**
  on `patch_active_file` / `patch_vault_file` (#58, reported by
  @folotp). Mirrors the v0.3.7 (#6) flip for `block` targets.

  Rationale: an unresolvable heading target (typo on the leaf,
  missing parent H1, stale heading reference) used to fall through
  to silent EOF append. In the dominant agent-caller use case the
  HTTP 200 is indistinguishable from a successful in-place patch
  without a post-write read, so silent-create is data corruption.
  The flip closes the residual silent-corruption surface that
  `detectOrphanRootHeading` (v0.3.9, #16) only partially covered.

  After the flip, per-target-type defaults are: `heading` →
  `false` (changed), `block` → `false` (unchanged from v0.3.7),
  `frontmatter` → `true` (unchanged; frontmatter keys rarely
  produce silent-corruption footguns and Templater-backed flows
  depend on key creation as intent).

  Callers that genuinely want the permissive create-on-missing
  behaviour for headings (rare — typically a migration script that
  creates section markers on first run) opt in explicitly with
  `createTargetIfMissing: true`. The wrapper-side
  `detectOrphanRootHeading` carve-out stays as defence-in-depth on
  the explicit opt-in path: the orphan-root H2+ shape is genuinely
  unresolvable regardless of opt-in intent and should still fail
  loud with `McpError(InvalidParams, …)`.

  Pinned by 7 cases in `patchVaultFile.test.ts` (default flip,
  explicit-true opt-in, explicit-false idempotence, frontmatter
  unchanged, block unchanged + its two opt-in cases). The
  `detectOrphanRootHeading` test surface from v0.3.9 stays intact.

  Breaking-change scope is symmetric to v0.3.7 (#6): only callers
  who today rely on `patch_*_file` with `targetType: "heading"`
  and an *unresolvable* `target` silently creating a heading at
  EOF are affected. That behaviour is the data-corruption path the
  surrounding fixes have been progressively closing — this flip is
  the final closure on the heading axis.

## [0.4.0] — TBD

The HTTP-embedded pivot. The plugin now hosts the MCP server in-process inside Obsidian and exposes Streamable HTTP on `127.0.0.1:27200`. **No native binary shipped from this repository** — closes the supply-chain attack surface that prompted upstream's official unmaintained declaration on 2026-04-24.

End-to-end smoke validated in vault TEST + Claude Desktop: 20/20 tools registered, native semantic search (MiniLM-L6-v2) returns cosine matches in the low-ms range, `npx mcp-remote` bridge connects Claude Desktop to the in-process server.

This entry consolidates the four alpha pre-releases and the beta. The full per-tag detail (with the running iteration of test counts and known-limitation deltas) is preserved on the GitHub Releases page; the alpha and beta tags themselves are kept in the repository.

### Added — HTTP transport (Phase 1)

- **Streamable HTTP transport** (MCP spec 2025-06-18) on `127.0.0.1:27200` (fallback 27201-27205). Bind is loopback only; no external network exposure.
- **Middleware chain**: method/path allow-list (POST/GET on `/mcp` and `/mcp/*`), Origin validation against loopback regex (anti-DNS-rebinding per spec), Bearer token auth with `crypto.timingSafeEqual` (UTF-8 byte-length safe).
- **Bearer token** generated at first load, persisted in `data.json` at `mcpTransport.bearerToken`. Rotatable from Settings → MCP Connector → Access Control.
- **`ToolRegistry` ported in-process** from `packages/mcp-server` to the plugin, with the same ArkType-based registration and error formatting.
- **Plugin lifecycle integration**: `onload` starts the HTTP server and MCP service; `onunload` tears down cleanly. Start failure surfaces as an Obsidian Notice and logs via the shared logger; the rest of the plugin loads anyway.

### Added — Tool surface (Phase 2)

- **All 19 0.3.x tools migrated** to the in-process server (vault read/write/patch/delete/list, search variants, template execution, web fetch, command list/execute). Plus `get_server_info` for health checks. **20 tools total.**
- **Per-request transport**: `StreamableHTTPServerTransport` is built fresh per HTTP request (stateless mode forbids reuse across requests; the MCP SDK enforces this in `webStandardStreamableHttp.js`). The `ToolRegistry` stays a singleton so per-request cost is on the order of milliseconds.

### Added — Native semantic search (Phase 3)

- **`search_vault_smart` no longer requires Smart Connections.** A new native provider runs entirely on-device via `@xenova/transformers` 2.17.2 + `Xenova/all-MiniLM-L6-v2` (384-dim embeddings, ~25 MB). Cosine flat scan with vectorized typed-array math. Folder include/exclude filters apply before scoring.
- **Provider tri-state setting**: `auto` (default — Smart Connections if installed, otherwise native), `native` (always Transformers.js), `smart-connections` (always SC; errors actionably if absent).
- **Live indexer** (default): subscribes to `vault.on('modify'|'create'|'delete')`, debounces per-file edits (2s), re-chunks, reuses vectors for unchanged chunks (chunk-delta), drops records on file delete.
- **Low-power indexer** (opt-in): 5-minute interval scan against `getMarkdownFiles().mtime`, single batched `store.flush()` per cycle.
- **Embedding store** at `<pluginDir>/embeddings.bin` (sequential Float32) + `embeddings.index.json`. Format version 1; mismatch triggers a clean re-index with a warning.
- **Lazy start**: the indexer is constructed at plugin onload but not auto-started — it kicks in on the first `search_vault_smart` call so plugin boot stays fast and the ~25 MB MiniLM download only happens for users who actually use semantic search.
- **Settings UI** (`SemanticSettingsSection.svelte`): tri-state radio + indexing-mode radio + unload-when-idle toggle + indexed-chunk count + Rebuild button.
- **Model download progress** (`ModelDownloadProgress.svelte`): progress card during the first-run download (subscribes to a `ModelDownloader` state machine — idle → downloading → ready / error with retry).
- **Embedder optimizations**: LRU query cache (size 32), unload-when-idle timer (60s default), shared in-flight `Promise<PipelineFn>` dedupes concurrent first-call.
- **Chunker**: heading-section (H1/H2) split with 512/64-token sliding window fallback for over-long sections; frontmatter concatenated to the first chunk; sections under 20 tokens skipped; SHA-256 content hashing (16 hex chars) for chunk-delta detection.
- **Electron-WASM compatibility**: `bun.config.ts` redirects `onnxruntime-node` resolves to a shim that re-exports `onnxruntime-web` (the WASM backend Electron renderer inherits as `process?.release?.name === 'node'`); `embedder.ts` configures `onnxruntime-web` env on first call (`wasmPaths` pointed at jsdelivr CDN for `onnxruntime-web@1.14.0` to work around Bun CJS losing `import.meta.url` for `.wasm` siblings; `numThreads = 1` because the renderer lacks COOP/COEP for SharedArrayBuffer; `allowLocalModels = false`; `useBrowserCache = true`).

### Added — Migration UX + client config (Phase 4)

- **First-load migration modal** (Svelte) shown at `app.workspace.onLayoutReady` when the detector finds at least one of: legacy `installLocation` / `platformOverride` keys in `data.json`, an orphan `mcp-server` binary at the previous install location (`INSTALL_PATH[platform]`), or a Claude Desktop config entry pointing at the binary (under either the new `mcp-tools-istefox` key or the legacy upstream `obsidian-mcp-tools` key). Three opt-in steps: rewrite Claude Desktop config (with `.backup`), delete the legacy binary, prune legacy keys. Each step independent; failure in one does not skip the others. `migration.skippedAt` persisted on dismiss / completion so the modal does not re-open on every plugin load.
- **`updateClaudeDesktopConfig`** rewrites the entry to the 0.4.0 shape (`{ command: "npx", args: ["-y", "mcp-remote", ..., "--header", "Authorization: Bearer …"] }`), backs up to `<configPath>.backup`, removes the legacy `obsidian-mcp-tools` key, refuses to overwrite malformed JSON.
- **Three "Copy config" buttons** under "Quick setup for clients": Claude Desktop (`npx mcp-remote` bridge), Claude Code (`{ type: "http", … }`), and a generic streamable-http payload for Cursor / Cline / Continue / Windsurf / VS Code.
- **Auto-write Claude Desktop config** opt-in toggle (default OFF). When ON, the plugin keeps `claude_desktop_config.json` in sync on token rotation / port change, with `.backup` written before each rewrite.
- **Bearer-token field** with Show / Copy / Regenerate; rotation invalidates the in-process transport and restarts it immediately so the new token takes effect on the next request.
- **Node.js detection** with launchctl-PATH fallback. macOS Obsidian launched from Finder/Spotlight inherits a minimal PATH that does not include `/opt/homebrew/bin` (Apple silicon) or `/usr/local/bin` (Intel) — plain `node --version` then ENOENTs even when Node IS installed. The detector now scans canonical absolute paths in addition to PATH-based lookup, on macOS, Linux, and Windows.
- **Homebrew detection** + one-click "Install via Homebrew" button (macOS) when Node is not on PATH but `brew` is available. Streams `brew install node` progress lines into the UI.
- **`mcp-remote` pre-warm**: runs `npx -y mcp-remote@latest` once via the absolute npx path derived from the detected Node, with the Node bin dir prepended to the child env PATH so npx's shebang `env node` lookup succeeds. Treats `mcp-remote`'s own `ERR_INVALID_URL` error as success (the package downloaded into `~/.npm/_npx/<hash>` — the goal of the pre-warm).

### Changed

- **Local REST API is now optional.** A missing LRA logs at debug level instead of showing the misleading "required" Notice. Only the `search_vault` tool (DQL / JsonLogic queries) needs it; it returns an actionable error to the MCP client when LRA is not installed. The other 19 tools work without it. The three legacy LRA endpoint registrations (`/search/smart`, `/templates/execute`, `/mcp-tools/command-permission/`) are no longer mounted — they were callbacks the 0.3.x binary used; in 0.4.0 the in-process MCP server calls Obsidian APIs directly.
- **`search_vault_smart` output shape** unified across providers: `{ filePath, heading, excerpt, score }`. Same shape whether the backend is Smart Connections or the native provider. Breaking vs the alpha.2 shape (which used `{ path, score, breadcrumbs, text }`).
- **`POST /templates/execute` response shape** (carried forward from 0.3.12): 503 body now includes `message` (#19) and success body now includes `path` (#20) — both contributed by @folotp, with the `tp.file.move()` semantic seam anchored as an inline design note in `handleTemplateExecution`.
- **`OBSIDIAN_HOST` accepts URL forms** (carried forward from 0.3.12): bare hostname (the documented form) and full URL with protocol+port both work; the wrapper detects `://` and parses via `parseApiUrl` (#21, originally upstream `jacksteamdev/obsidian-mcp-tools#84`).
- **0.3.x install surface retired** in 0.4.0 settings (`mcp-server-install/components/McpServerInstallSettings.svelte` no longer mounted; kept in tree for rollback safety; full removal in a follow-up).

### Continuous integration

- New `.github/workflows/ci.yml` runs `bun run check` + per-package `bun test` on every push to `main` and `feat/http-embedded`, plus on every PR targeting either branch. Cancels in-flight runs for the same ref when a new push lands.

### Tests

528+ unit + integration tests pass across the four phases:

- 87 across `features/migration/` and `features/mcp-client-config/` (Phase 4).
- 123 across `features/semantic-search/` (Phase 3).
- 244 across `features/mcp-transport/`, `features/core/`, `features/access-control/`, settings (Phase 1).
- The remaining baseline carried forward from 0.3.x: tool registry, command-permissions, mcp-server-install, plus the patch / smart-search / templates regression suites.

### Known limitations

- **`Disabled MCP tools` (toolToggle) UI hidden in 0.4.0.** On 0.3.x the toggle wrote `OBSIDIAN_DISABLED_TOOLS` into the binary's env and the binary read it at startup to filter the registered tools. The 0.4.0 in-process registry has no equivalent gating path yet, so showing the UI would be misleading — the user could "disable" a tool that would still be reachable on the next call. The persisted `toolToggle.disabled` slice in `data.json` is left intact, so future installs can read it back without losing data; a 0.4.x follow-up will wire registry gating and re-mount the UI.

### References

- Design: [`docs/design/2026-04-24-http-embedded-design.md`](docs/design/2026-04-24-http-embedded-design.md)
- Phase plans: `docs/plans/0.4.0-phase-{1,2,3,4}-*.md`
- Upstream context: [`jacksteamdev/obsidian-mcp-tools#79`](https://github.com/jacksteamdev/obsidian-mcp-tools/issues/79) (official unmaintained, 2026-04-24)
- Pre-release tags: `0.4.0-alpha.1`, `0.4.0-alpha.2`, `0.4.0-alpha.3`, `0.4.0-alpha.4`, `0.4.0-beta.1` — see [GitHub Releases](https://github.com/istefox/obsidian-mcp-connector/releases) for the full per-tag detail.

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
