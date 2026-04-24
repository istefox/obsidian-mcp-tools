# 0.4.0 — Plugin-embedded MCP server (HTTP transport)

| | |
|---|---|
| **Status** | Approved — ready for implementation planning |
| **Date** | 2026-04-24 |
| **Author** | Stefano Ferri (@istefox) |
| **Audience** | Project maintainers, future contributors |
| **Related** | [`jacksteamdev/obsidian-mcp-tools#79`](https://github.com/jacksteamdev/obsidian-mcp-tools/issues/79) (upstream unmaintained declaration), [`obsidianmd/obsidian-releases#11919`](https://github.com/obsidianmd/obsidian-releases/pull/11919) (community store submission), `docs/design/issue-29-command-execution.md` (command execution policy — preserved) |

## Executive summary

This document specifies the architectural pivot from the current stdio + external binary design (0.3.x) to a **plugin-embedded HTTP server** design (0.4.0).

The pivot has three drivers:

1. **Upstream maintainer's official position.** On 2026-04-24 @jacksteamdev declared `jacksteamdev/obsidian-mcp-tools` officially unmaintained, citing the supply-chain exposure of shipping platform binaries. He offered to link from the upstream README to any plugin that (a) uses MCP over HTTP and (b) is published in the official Obsidian community store. This design targets both conditions.
2. **Competitive positioning.** Five in-process Obsidian MCP plugins are already active as of 2026-04 (`aaronsb`, `rygwdn`, `jlevere`, `dsebastien`, `Chepech/anamnesis`). None are in the community store yet. The window to be the first in-process plugin in the store is estimated at 3-6 months. The strategic goal is leadership of the segment, leveraging the 74k install base of the dormant upstream.
3. **Permanent fix for the installer 404 class of bugs** (see [#3](https://github.com/istefox/obsidian-mcp-connector/issues/3)). Removing the external binary removes the entire failure surface.

Target transport: **Streamable HTTP** (MCP spec 2025-06-18, stable). Claude Desktop does not yet speak HTTP natively (bug [anthropics/claude-code#30327](https://github.com/anthropics/claude-code/issues/30327)); it is supported via `npx mcp-remote`, the official Anthropic-maintained stdio-to-HTTP bridge. All other major MCP clients (Claude Code CLI, Cursor, Cline, Continue, VS Code, Windsurf) speak HTTP natively.

## Goals

1. Plugin-embedded MCP server, in-process. Zero binary shipped from the repo.
2. Streamable HTTP as the primary transport, targeting MCP spec `2025-06-18`.
3. Claude Desktop support via `npx mcp-remote` with auto-generated client config.
4. Full bypass of Local REST API — direct use of `app.vault.*`, `app.workspace.*`, `app.metadataCache.*`, `app.fileManager.*`, `app.commands.*`. Local REST API becomes optional.
5. Feature parity with 0.3.x (all 20 current tools ported) plus a competitive differentiator: **native semantic search** via local embeddings (`@xenova/transformers`, MiniLM-L6-v2). Smart Connections is retained as an alternative path if the user has it installed.
6. Seamless migration UX from 0.3.x with automatic rewrite of `claude_desktop_config.json`.
7. Community store ready: no open ESLint findings, no runtime-required external dependencies beyond the Obsidian API and the on-demand embeddings model download.

## Non-goals

1. Obsidian mobile support. `isDesktopOnly: true` remains. Local embeddings require filesystem + WASM runtime unsuitable for mobile.
2. Multi-vault per plugin instance.
3. Remote hosting. Loopback only, spec-compliant.
4. Runtime coexistence between 0.3.x and 0.4.0 on the same vault (prevented by Obsidian's single-plugin-per-id model).
5. OAuth 2.1 authorization. Deferred until a remote use case emerges.

## Technical decisions (resolved before this document)

The following decisions were made during brainstorming and are recorded here with their rationale so they can be revisited in review.

### D1. Authentication: static Bearer token

**Decision:** Plugin generates a 32-byte random token at install time (`crypto.randomBytes(32).toString("base64url")`), stores it in `data.json`, and requires it on the `Authorization: Bearer` header of every incoming request. Rotatable via Settings UI. Comparison uses `crypto.timingSafeEqual` to prevent timing attacks.

**Rationale:** OAuth 2.1 is the spec-blessed path but overkill for a single-user loopback server. Static bearer is the de-facto standard accepted by all major MCP HTTP clients (Claude Code, Cursor, Cline, Continue). The threat model of the plaintext token in `data.json` is identical to that of Obsidian's own data — filesystem access already defeats any in-process secret.

### D2. Claude Desktop shim: `npx mcp-remote`

**Decision:** The plugin generates a `claude_desktop_config.json` entry that invokes `npx -y mcp-remote http://127.0.0.1:PORT/mcp --header 'Authorization: Bearer TOKEN'`. No binary is shipped from this repo.

**Rationale:** Anthropic maintains `mcp-remote` on npm as the official stdio-to-HTTP bridge. It runs via `npx` (no permanent install), requires only Node.js on the user's machine (acceptable for the MCP+Obsidian target audience, which is developer-leaning), and keeps this project free of supply-chain responsibility for a compiled binary. Alternative approaches (shipping our own compiled shim, shell scripts with `curl`, bundling Node) all reintroduce the exact concern @jacksteamdev raised.

### D3. Port binding: configurable default `127.0.0.1:27200` with fallback

**Decision:** Default port `27200`. On `EADDRINUSE`, try `27201…27205`. Override configurable in settings. Bind to loopback only; spec-mandated Origin validation blocks DNS-rebinding vectors.

**Rationale:** `27200` stays inside the "Obsidian range" (27xxx) without colliding with any known Obsidian ecosystem port: `27124` (Local REST API, also used by `dsebastien/obsidian-cli-rest`), `27125` (`rygwdn/obsidian-mcp-plugin`), `3001` (`aaronsb/obsidian-mcp-plugin`). An initial choice of `27125` was rejected after discovering the rygwdn collision during competitive research — users installing both plugins, or migrating from rygwdn, would face EADDRINUSE on the default. `27200` is first-hit-safe across the landscape as of 2026-04.

### D4. Migration: opt-in modal with config rewrite + binary cleanup

**Decision:** On first launch of 0.4.0 when 0.3.x state is detected (presence of legacy `mcp-server-*` binary or `installLocation` key in `data.json`), show a one-time modal offering to (a) rewrite the `claude_desktop_config.json` entry to the new HTTP shim form with backup, (b) delete the old binary directory, (c) suggest but not force uninstall of Local REST API if unused by other plugins.

**Rationale:** Opt-in avoids surprising destructive actions. Backup preserves recoverability. Suggestion over force respects user's broader plugin setup.

### D5. Test infrastructure: extend the existing Obsidian mock

**Decision:** Extend `packages/obsidian-plugin/src/test-setup.ts` with stubs for `app.vault.*`, `app.workspace.*`, `app.metadataCache.*`, `app.fileManager.*`, `app.commands.*`, `requestUrl`. All backed by in-memory state reset in `beforeEach`. No new test framework.

**Rationale:** The existing mock has proven sufficient for integration tests (see `status.integration.test.ts`, command-permissions 35-way regression). Incremental extension preserves continuity. ArkType schemas on all tool I/O catch drift between mock and real API.

### D6. Bearer token UI: hybrid — password-style field plus per-client copy-config

**Decision:** Settings UI exposes a single password-style field for the bearer token with Show/Hide toggle, Copy button, and Regenerate button. Alongside, three per-client "Copy config" shortcuts (Claude Desktop, Claude Code, Cursor/Cline/Continue) produce a fully-formed entry ready to paste.

**Rationale:** The MCP+Obsidian audience is developer-leaning and benefits from direct access to the token (curl testing, MCP Inspector, custom clients). A password-style default + explicit Show toggle mirrors modern API-key UIs (OpenAI, Anthropic) and avoids accidental disclosure in screenshots. The per-client buttons cover the happy path without hiding the token from users who want to see it.

### D7. Claude Desktop setup UX: active Node.js detection plus opt-in `mcp-remote` pre-warm

**Decision:** At first setup (and on a "Verify again" action), the plugin runs `node --version` silently and shows the detection outcome in the "Claude Desktop integration" section of settings. A separate opt-in button labelled "Pre-warm mcp-remote (~30s, downloads ~5MB)" triggers `npx -y mcp-remote@latest --help` to populate the npm cache. When Node is missing, the section shows an actionable message linking to `nodejs.org` plus a "Verify again" button.

**Rationale:** Detection is pure added value — catches roughly 90% of user-side friction at setup time without any network side effect and without reaching beyond a harmless read of the environment. The pre-warm, by contrast, does have a real footprint (network + npm cache + time), so it is kept explicit and opt-in. This splits the passive/active trade-off cleanly.

### D8. Embedding model surface: single model at 0.4.0, second model in 0.5.0

**Decision:** 0.4.0 ships with `Xenova/all-MiniLM-L6-v2` as the only supported embedding model. No model selector in the UI at this release. 0.5.0 adds `Xenova/bge-small-en-v1.5` as an opt-in alternative behind an advanced setting, with a one-time re-index flow prompted via modal ("Upgrade to higher-quality embeddings? Requires re-index — about 15 min for a 5k-note vault.").

**Rationale:** bge-small-en-v1.5 offers a 3-5% MTEB uplift over MiniLM — measurable on benchmarks, imperceptible on typical Obsidian queries. Adding a model selector at 0.4.0 inflates the test matrix, adds UI choice surface, and expands an already-heavy release scope (20-tool port + HTTP + semantic + migration + client config + store submission). The 0.5.0 upgrade flow is a clean incremental story; one-time re-indexing for a quality upgrade is an established pattern in similar tools.

### D9. Semantic indexing cadence: per-change debounced default, opt-in low-power mode

**Decision:** The default indexing mode is event-driven: the vault watcher listens for `modify`/`create`/`delete`, enqueues the affected file, and processes it after 2 seconds of inactivity for that file. Re-embedding is chunk-delta-only (unchanged chunks of a modified note are not re-embedded; chunk identity is a content hash). A setting **Low-power indexing mode** (off by default) switches to a 5-minute polling loop that batches all files with `mtime > lastIndexTime`.

**Rationale:** The target audience's principal use pattern is iterative writing followed by immediate MCP query ("Claude, elaborate on what I just wrote"). Low edit-to-query latency matters more than power consumption for this workload. The debounce already filters the "save every few seconds while editing" burst into a single embedding job per file. The low-power mode is a minority-case override for users on battery or who prefer predictable, bursty CPU activity.

## Architecture

### Deployment topology

```
BEFORE (0.3.x)
    Claude Desktop  →  [stdio]  →  mcp-server binary  →  [HTTPS 27124]  →  Local REST API  →  Obsidian
    Claude Code     →  [stdio]  →  mcp-server binary  →  [HTTPS 27124]  →  Local REST API  →  Obsidian

AFTER (0.4.0)
    Claude Desktop  →  [stdio]  →  npx mcp-remote  →  [HTTP 27200/mcp]  ┐
    Claude Code     →  [HTTP 27200/mcp]  ───────────────────────────────┤→  MCP Connector plugin  →  Obsidian
    Cursor/Cline    →  [HTTP 27200/mcp]  ───────────────────────────────┘    (in-process)
    Continue/others
```

### Module layout

Following the feature-based pattern defined in `.clinerules`.

```
packages/obsidian-plugin/src/features/
├── mcp-transport/        NEW  HTTP server, StreamableHTTP transport,
│                              auth middleware, Origin validation, port binding
├── mcp-tools/            NEW  Tool handlers (ported from packages/mcp-server),
│                              ToolRegistry, ArkType schemas
├── semantic-search/      NEW  Local embeddings (MiniLM-L6-v2 WASM), indexer,
│                              storage, query pipeline, Smart Connections coexistence
├── mcp-client-config/    NEW  (replaces mcp-server-install) Generates client
│                              config entries for Claude Desktop (mcp-remote) and
│                              native HTTP clients. Handles 0.3.x migration.
├── command-permissions/  KEEP Unchanged. Preserves #29 threat model intact.
├── tool-toggle/          KEEP Unchanged.
└── core/                 KEEP Extended to register mcp-transport + mcp-tools
                              instead of installer.
```

The `packages/mcp-server/` package is retired. Portable contents (tool handlers, `ToolRegistry`, schemas) move to `packages/obsidian-plugin/src/features/mcp-tools/`. `packages/shared/` remains for cross-boundary schemas and logger.

### Data flow: single tool call

```
1. Claude Code → POST /mcp {method: "tools/call", name: "search_vault", args}
2. mcp-transport middleware:
     - method + path allow-list
     - Origin validation (allow missing, allow 127.0.0.1/localhost, reject others)
     - Authorization Bearer check with timingSafeEqual
3. StreamableHTTPServerTransport → McpServer → ToolRegistry
4. Handler calls app.vault.getMarkdownFiles() + domain filter
5. ArkType-validated response → JSON → HTTP response
```

No internal HTTPS hop. No API key shared with another plugin. No self-signed cert hack.

## Transport layer

### HTTP server

Node `http` built-in (no Express, no new framework dependency). Instantiated in `setup()`, destroyed in `onunload()`.

```
plugin.onload()
  ├─ generate bearer token if absent → data.json
  ├─ bind 127.0.0.1:27200 (fallback 27201-27205 on EADDRINUSE)
  ├─ http.createServer((req, res) => middleware(req, res))
  ├─ new McpServer(...) + StreamableHTTPServerTransport
  └─ register tools via ToolRegistry

plugin.onunload()
  └─ server.close() + transport.close()
```

### Middleware

Single function, roughly 30 LOC. Order:

1. Method check (POST and GET only — spec-mandated for StreamableHTTP).
2. Path check (`/mcp` and `/mcp/*` session variants).
3. Origin validation: missing is allowed (non-browser clients), `http://127.0.0.1:*` and `http://localhost:*` allowed, everything else 403. This is the spec's anti-DNS-rebinding guidance.
4. `Authorization: Bearer <token>` required, compared with `crypto.timingSafeEqual`. 401 on mismatch.
5. Hand off to `StreamableHTTPServerTransport`.

### Port fallback

```
const PORT_RANGE = [27200, 27201, 27202, 27203, 27204, 27205];
```

If all taken, show an actionable Notice and expose a manual port field in settings.

### Settings UI: access control and client config

The Access Control section surfaces the bearer token directly (D6) alongside three per-client shortcut buttons:

```
Access Control
  API key: [••••••••••••••••••] [👁 Show]  [📋 Copy]  [🔄 Regenerate]

  Quick setup for clients:
    [📋 Copy Claude Desktop config]
    [📋 Copy Claude Code config]
    [📋 Copy Cursor / Cline / Continue config]
```

The API key field is password-style by default. "Show" toggles to plaintext. "Regenerate" opens a confirm modal ("This invalidates the current token — all MCP clients need updated config").

Config shapes produced by each button:

- **Claude Desktop** — `{ "command": "npx", "args": ["-y", "mcp-remote", "http://127.0.0.1:27200/mcp", "--header", "Authorization: Bearer …"] }`.
- **Claude Code CLI** — `{ "type": "http", "url": "http://127.0.0.1:27200/mcp", "headers": { "Authorization": "Bearer …" } }`.
- **Other clients (Cursor, Cline, Continue, Windsurf, VS Code)** — `{ "type": "streamable-http", "url": …, "headers": … }`. Per-client inline notes cover naming variants (`streamableHttp` vs `streamable-http`).

**Auto-write Claude Desktop config** — opt-in toggle, default OFF. When ON, port changes or token rotations automatically rewrite the entry in `claude_desktop_config.json`. Default OFF avoids surprising changes to user-managed files.

### Claude Desktop integration setup

A dedicated "Claude Desktop integration" section in settings handles the Node.js prerequisite (D7):

```
Claude Desktop integration
  ✓ Node.js v22.3.0 detected                 [Verify again]
  ☐ mcp-remote not cached — [Pre-warm now] (optional, ~30s, ~5MB download)
```

If Node is missing:

```
Claude Desktop integration
  ✗ Node.js not found. Required for Claude Desktop bridge.
    → Install from nodejs.org                 [Verify again]
```

Behavior:

- **Detection** runs automatically on plugin load and on "Verify again". Implementation: spawn `node --version` via `child_process.exec` (Obsidian plugins have Node integration); cache result for the session. Read-only, no network.
- **Pre-warm** is user-initiated. Runs `npx -y mcp-remote@latest --help` and shows progress. On success, flips the checkbox to "✓ mcp-remote cached (version …)". On failure, shows an actionable error (network issue, permissions). Running the same command again is idempotent.

The pre-warm is purely a UX smoothing step for Claude Desktop's first invocation of the bridge — `mcp-remote` is installed via `npx` at runtime regardless, but pre-warming avoids the 20-60s first-run delay the user would otherwise see when launching Claude Desktop for the first time after setup.

### Token rotation UX

"Regenerate API key" button opens a confirm modal ("This will invalidate the current token — all MCP clients will need updated config"). On confirm: new token written to `data.json`, auto-rewrite if enabled, UI refresh of the three copy-config sections.

## Tool implementation

The 20 current tool handlers port mechanically: ArkType schemas, `ToolRegistry`, error shapes, boolean-string coercion all stay identical. Only the layer underneath changes — `makeRequest(schema, endpoint, body)` becomes direct calls to `app.*`.

### Tool group mapping

| Tool group | Count | Before (REST API) | After (Obsidian API) |
|---|---|---|---|
| Active file ops | 5 | `PATCH/PUT/POST/DELETE /active` | `app.workspace.getActiveFile()` + `app.vault.{modify,read,create,delete}` |
| Vault file ops | 6 | `GET/POST/PUT/PATCH/DELETE /vault/{path}` | `app.vault.getAbstractFileByPath()` + same verbs |
| List vault files | 1 | `GET /vault/` | `app.vault.getFiles()` filtered by folder |
| Text search | 2 | `POST /search/` | `app.vault.cachedRead` + in-server matching |
| Open in Obsidian | 1 | `POST /open/{path}` | `app.workspace.openLinkText()` |
| Server info | 1 | `GET /` | Synthesized from plugin version + status |
| Fetch URL | 1 | N/A | `requestUrl()` (Obsidian built-in) — satisfies the store's `no-fetch` rule without `/skip` |
| Commands | 2 | `GET/POST /commands/…` | `app.commands.{listCommands,executeCommandById}` |
| Semantic search | 1 | `POST /search/smart` | Section § Semantic search |
| Templater | 1 | `POST /templates/execute` | `loadTemplaterAPI` — already wired in 0.3.x |

### Patch-file simplification

`patch_active_file` and `patch_vault_file` currently serialize a hard-to-generate header/body format for Local REST API's `PATCH` endpoint. With direct access to Obsidian's APIs, the logic collapses:

- Heading insertion: `app.metadataCache.getFileCache(file).headings` + `app.vault.modify` with slice computation.
- Block reference insertion: same via `.blocks`.
- Frontmatter field update: `app.fileManager.processFrontMatter(file, fn)` — Obsidian's purpose-built API.

Expected LOC reduction per tool: ~150 → ~80. Fewer edge cases, fewer bugs.

### Fetch: `fetch` → `requestUrl`

`features/fetch/index.ts` currently uses the Node runtime's global `fetch`. Moved into the plugin, it must use Obsidian's `requestUrl`. This satisfies the community-plugin ESLint rule that previously required a `/skip` exemption. Turndown and the rest of the markdown conversion logic remain unchanged.

### Security-critical: command execution

The `command-permissions` module (policy, mutex, modal, deny-by-default) ports **intact**. The threat model in `docs/design/issue-29-command-execution.md` is load-bearing. Flow after pivot:

```
1. HTTP request → execute_obsidian_command tool
2. Tool handler → command-permissions/permissionCheck.ts  (UNCHANGED)
   - Phase A mutex: load settings → decide allow/deny/ask
   - Modal outside lock
   - Phase B mutex: persist final outcome
3. Allow → app.commands.executeCommandById(id)
4. Deny → MCP error
```

The rate limiter (100/min tumbling window) ports as pure logic with no runtime dependencies.

### `ToolRegistry`, ArkType, boolean coercion

No changes. The registration pattern is transport-agnostic. Boolean string coercion stays centralized. `execute_template.createFile: "true"|"false"` as string belt-and-suspenders remains until all modern clients are confirmed to send native booleans.

## Semantic search

The competitive differentiator. Only in-process plugin with native semantic search plus the full tool surface.

### Stack

- **`@xenova/transformers`** (Transformers.js) — ONNX runtime in JS/WASM. Battle-tested, runs in Node/Electron.
- **Model at 0.4.0 (single):** `Xenova/all-MiniLM-L6-v2` — 384-dim, ~25MB quantized. Universal baseline. No model selector in 0.4.0 (D8). `Xenova/bge-small-en-v1.5` is deferred to 0.5.0 behind an advanced setting with a one-time re-index flow.
- **Storage:** binary flat file `{vault}/.obsidian/plugins/mcp-tools-istefox/embeddings.bin` (sequential Float32) + separate index JSON `embeddings.index.json` for `{chunkId → {filePath, offset, heading, contentHash}}`. No SQLite. The `contentHash` supports chunk-delta re-embedding under live mode (D9).

### Model distribution

The model is **not** bundled in the plugin zip (25-35MB would push the plugin to ~30MB on download). Instead: lazy download on first indexing, cached to plugin directory, progress UI during download.

### Chunking

Heading-section chunks (H1/H2), with a 512-token / 64-overlap sliding window fallback for sections that exceed the window. Frontmatter is concatenated to the first chunk of the file. Inline tags and wikilinks are preserved in the embedded text. Files under 20 tokens are skipped.

### Indexing pipeline

Two modes, selected in settings (D9). Default is **Live**.

**Live mode (default)** — event-driven, per-change debounced:

```
SemanticIndexer (live)
  ├─ on plugin enable with native search ON:
  │    schedule full index build (debounced, idle-triggered)
  ├─ on vault file change (app.vault.on "modify"/"create"/"delete"):
  │    enqueue affected file for re-chunk
  │    process queue after 2s inactivity for that file
  ├─ on re-chunk:
  │    compute contentHash per chunk; re-embed only chunks whose
  │    hash changed (chunk-delta). Untouched chunks keep existing
  │    embeddings.
  ├─ on embedding done:
  │    append/update embeddings.bin, update index JSON
  └─ on plugin disable:
       flush queue, close files
```

**Low-power mode (opt-in)** — interval polling:

```
SemanticIndexer (low-power)
  ├─ every 5 minutes: scan app.vault for files with mtime > lastIndexTime
  ├─ batch re-chunk + re-embed affected files (chunk-delta as above)
  └─ single write back to embeddings.bin + index JSON per batch
```

Settings snippet:

```
Semantic search
  Indexing mode:
    (•) Live (responsive, recommended)
    ( ) Low-power (re-index every 5 min, saves battery)

  ☑ Unload model when idle (60s)   ← independent, additional power saver
```

Estimate for a 5000-note vault, first-time full index: ~10-15 min background on modern CPU (mode-independent). Incremental updates in live mode: < 500ms per file due to chunk-delta. Low-power batches are bursty but coalesce consecutive edits.

### Query pipeline

```
1. Receive query string + optional filters (folder include/exclude, limit)
2. Embed query (LRU cache size 32 for recent queries)
3. Cosine similarity against embeddings.bin (flat scan — 50k chunks fits RAM,
   vectorized via typed arrays, ~20ms on modern CPU)
4. Top-K by score, apply filters, return with file path + heading + excerpt
```

Flat scan beats approximate indices (HNSW, IVF) for vaults under ~100k chunks. HNSW is deferred to 0.6.x if vault size evidence demands it.

### Smart Connections coexistence

Settings tri-state:

1. **Native embeddings** (default): Transformers.js local.
2. **Smart Connections**: delegates if installed, actionable error otherwise.
3. **Auto**: Smart Connections if installed and indexed, else native.

The `search_vault_smart` tool handler dispatches via a `SemanticSearchProvider { search(query, opts) }` interface with two implementations. No duplicated logic.

### Competitive positioning

- **Anamnesis**: native embeddings, 3 tools. We: 20+ tools + native semantic.
- **aaronsb / rygwdn / jlevere**: no native semantic. Smart Connections or nothing.
- **Smart Connections users (74k install base)**: their dependency becomes optional with us, with a zero-config alternative built-in.

### Runtime cost

- Bundle: +~200KB for Transformers.js runtime (model is external).
- RAM: ~150-200MB with model loaded. Settings option "Unload model when idle" for memory-constrained users.
- Cross-platform: WASM backend is always available; native CPU backend is used when present. macOS / Windows / Linux all supported.

### Out-of-scope for 0.4.0 / 0.5.0

- Hybrid reranking (BM25 + semantic) — 0.5.x.
- Cross-lingual embeddings — 0.5.x on user demand.
- Incremental HNSW — 0.6.x if warranted.
- Image / PDF embeddings — 0.6+ long-term.

## Migration & coexistence

### Branch strategy

```
main                       stable, 0.3.x patch only
└── feat/http-embedded     0.4.0 development
    ├─ 0.4.0-alpha.N tags  BRAT opt-in testing
    ├─ 0.4.0-beta.N tags   BRAT pre-release
    └─ 0.4.0 release tag   merge into main, bump main → 0.4.0
```

After merge, `0.3.x` lives on `branch-0.3` for critical patches. End-of-Life 4-8 weeks post-0.4.0 stable.

### Plugin id

`mcp-tools-istefox` stays. The Obsidian store treats major version bumps as normal upgrades — no user friction. A change would force all existing BRAT users into a full uninstall/reinstall cycle with settings loss.

### Store submission strategy

`obsidianmd/obsidian-releases#11919` is open (2026-04-18) with automated lint passed, awaiting human review. Recommended path: **get 0.3.5 into the store as soon as review arrives**, then ship 0.4.0 as a normal update. This maximizes time-in-store and inherits the 74k jacksteamdev MCP Tools user base through the upstream README link as soon as that link becomes possible.

### User migration modal

On first load of 0.4.0 with 0.3.x state detected (legacy binary present or `installLocation` key in `data.json`):

```
MODAL: "Welcome to MCP Connector 0.4.0"

The plugin has moved to a new architecture:
  - No more external binary (mcp-server-*)
  - No more Local REST API dependency
  - Direct integration with Obsidian

We can migrate your setup automatically:
  [✓] Update Claude Desktop config to use the new HTTP endpoint
  [✓] Remove the old mcp-server binary from disk
  [ ] Uninstall Local REST API plugin (keep it — other plugins may use it)

[Migrate]  [Skip for now]  [Learn more]
```

Migration actions, all opt-in:

1. `claude_desktop_config.json` rewrite: backup to `.backup`, replace only the `mcp-tools-istefox` entry, preserve others intact.
2. Binary cleanup: platform-specific path (`~/AppData/Roaming/…`, `~/Library/Application Support/…`, `~/.local/share/…`). Recursive delete with confirmation.
3. Local REST API: suggest uninstall in UI. Do not force.
4. Settings migration: preserve `commandPermissions` and `toolToggle` (schema-compatible); drop `installLocation` and `platformOverride` (no-op).

### Compatibility surface

- `packages/mcp-server/` — retired. No compat shim.
- `packages/shared/` — schemas compatible, no breaking change.
- `data.json` — additive: new `mcpTransport.bearerToken`, `semanticSearch.provider`; legacy fields become no-ops.
- `claude_desktop_config.json` — handled via migration modal.

### Runtime coexistence

Different vaults, different Obsidian instances: supported. Different bearer tokens, separate ports via fallback.
Same vault, both 0.3.x and 0.4.0: not supported (Obsidian disallows multiple versions of the same plugin id). Non-issue.

### Deprecation timeline

```
0.4.0 stable       → 0.3.x enters maintenance (bugfix only)
+2 weeks           → no new features on branch-0.3
+4 weeks           → EOL notice in README
+8 weeks           → branch-0.3 archived (read-only)
```

Security fixes continue on `branch-0.3` while detectable active users remain (BRAT download signal).

## Testing strategy

### Pyramid

```
UNIT (bun test, in-process mock)
  ├─ tool handlers individually (20 tools × 3-5 edge cases ≈ 80 tests)
  ├─ ToolRegistry + ArkType boolean coercion
  ├─ command-permissions policy (preserves 35-way regression)
  ├─ semantic-search chunking + cosine similarity (pure functions)
  └─ mcp-client-config entry generation + migration parsing

INTEGRATION (bun test, extended Obsidian mock)
  ├─ HTTP transport wiring end-to-end: bind → middleware → transport → tool call
  ├─ Auth + Origin validation request matrix
  ├─ SemanticIndexer lifecycle: index → modify → re-embed → query
  ├─ Port fallback on EADDRINUSE
  └─ Migration flow: detect → rewrite → verify backup

E2E (manual, guided runbook)
  ├─ bun run inspector against a running Obsidian
  ├─ Claude Desktop + npx mcp-remote → real tool call
  ├─ Claude Code CLI → real tool call over HTTP
  ├─ Cursor / Cline / Continue → real tool call over HTTP
  └─ Fresh vault, fresh install: first-time UX + first semantic index
```

### Mock runtime extension

`packages/obsidian-plugin/src/test-setup.ts` extends with in-memory backed:

```
app.vault.*         — getAbstractFileByPath, getFiles, read, modify, create, delete
app.workspace.*     — getActiveFile, openLinkText
app.metadataCache.* — getFileCache (headings, blocks, frontmatter)
app.fileManager.*   — processFrontMatter
app.commands.*      — listCommands, executeCommandById
requestUrl          — fetch mock with response injection
```

~250 LOC addition. ArkType schemas at every I/O boundary act as the drift guard between mock and real.

### CI

Release workflow simplifies to plugin-only:

```
on: push tag
  ├─ bun install --frozen-lockfile
  ├─ bun test
  ├─ bun run check
  ├─ bun run build (plugin only)
  ├─ bun run zip
  └─ upload obsidian-plugin-*.zip + main.js + manifest.json with SLSA attestation
```

Cross-platform binary builds are removed. A new on-PR workflow runs lint + test + check on every PR against `main` and `feat/http-embedded`.

## Release phases & timeline

```
Week 1-2   Design doc approved; feat/http-embedded branch
           mcp-transport skeleton, HTTP wiring, auth middleware
           mock runtime extension

Week 3-4   Tool handler migration (20 tools × direct Obsidian API)
           command-permissions ported intact
           patch-file logic simplified

Week 5-6   Semantic search: Transformers.js integration, SemanticIndexer,
           storage, query pipeline, Smart Connections coexistence

Week 7     Migration UX: modal, config rewrite, binary cleanup
           Client config generators for three target client families

Week 8     Alpha: 0.4.0-alpha.1 on BRAT, manual E2E matrix
           Documentation pass: README, CHANGELOG, CLAUDE.md

Week 9     Beta: 0.4.0-beta.1, alpha feedback triage
           Store PR #11919 decision (push 0.4.0 or let 0.3.5 in first)

Week 10    0.4.0 stable tag + release
           README PR to upstream + Discord DM to @jacksteamdev
           0.3.x → branch-0.3 for bugfix maintenance

Week 14    0.5.0: reranking + HNSW if vault size demands
```

Prudent estimate. Compressible to 6-7 weeks with focused execution; 10 weeks includes realistic buffer for unforeseen platform quirks or client compatibility issues.

## Risk register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Transformers.js ONNX issue on a specific platform | medium | high | Tri-state setting falls back to Smart Connections or disables semantic entirely |
| `app.*` edge cases uncovered by the mock | high | medium | Manual integration tests against a real vault before each release; document known gaps |
| Community store review delay | high | medium | 0.3.5 stays in the review queue as baseline; 0.4.0 is a normal store update |
| Competitor `aaronsb` submits to store first | medium | high | Execution velocity; BRAT alpha tag by Week 8 |
| Bearer auth rejected by some client | low | medium | Origin check is robust; per-client documentation covers header quirks |
| Plugin bundle becomes too large | low | low | Lazy code-split: semantic module loaded only when enabled |
| Claude Desktop HTTP bug not fixed within timeline | medium | low | `npx mcp-remote` path does not depend on that fix |

## Success criteria (definition of done for 0.4.0)

1. All 20 current tools operate via the HTTP endpoint — case-for-case parity tests pass.
2. Native semantic search query → result in under 100ms on a 5k-note vault.
3. Fresh install in under 60s end-to-end (plugin enable → first successful tool call from Claude Code).
4. Migration from 0.3.x completes with no settings or config loss.
5. Zero ESLint errors from `ObsidianReviewBot`.
6. `0.4.0` accepted in the official community plugin store.
7. Link in the `jacksteamdev/obsidian-mcp-tools` README obtained (jacksteamdev's stated condition).
8. At least five pieces of community feedback within two weeks post-release (adoption proxy).

## References

- Spec: [MCP Transports — 2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
- Spec: [MCP Authorization — draft](https://modelcontextprotocol.io/specification/draft/basic/authorization)
- Anthropic: [Custom connectors using remote MCP](https://support.claude.com/en/articles/11175166-about-custom-connectors-using-remote-mcp)
- Anthropic: [Getting started with local MCP servers](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop)
- Bug: [anthropics/claude-code#30327](https://github.com/anthropics/claude-code/issues/30327) — Claude Desktop HTTP transport not yet supported
- Clients: [MCP Example Clients](https://modelcontextprotocol.io/clients), [Stacklok client compatibility](https://docs.stacklok.com/toolhive/reference/client-compatibility)
- `mcp-remote`: [npm package](https://www.npmjs.com/package/mcp-remote)
- Upstream position: [jacksteamdev/obsidian-mcp-tools#79](https://github.com/jacksteamdev/obsidian-mcp-tools/issues/79)
- Store PR: [obsidianmd/obsidian-releases#11919](https://github.com/obsidianmd/obsidian-releases/pull/11919)
- Related in-repo: `.clinerules`, `docs/project-architecture.md`, `docs/design/issue-29-command-execution.md`, `CLAUDE.md`
