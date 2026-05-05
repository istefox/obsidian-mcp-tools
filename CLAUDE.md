# CLAUDE.md

Guidance for Claude Code (and similar AI agents) working in this repository.

## Project

**MCP Tools for Obsidian** — a Model Context Protocol (MCP) bridge that lets AI clients such as Claude Desktop access an Obsidian vault for reading, writing, searching (text + semantic), and executing templates, without bypassing Obsidian itself.

Two shipping components glued together by the Local REST API plugin:

1. **Obsidian plugin** — installs/updates a signed MCP server binary, writes `claude_desktop_config.json`, and exposes extra HTTP endpoints that the server calls back into (semantic search via Smart Connections, template execution via Templater).
2. **MCP server binary** — long-lived subprocess launched by Claude Desktop over stdio. Translates MCP tool/prompt calls into HTTPS requests against the Obsidian Local REST API plugin on `127.0.0.1:27124`.

Why the detour through Local REST API instead of reading `.md` files directly: it preserves Obsidian's metadata cache, respects file locks on open notes, and lets the server invoke other Obsidian plugins (Templater, Smart Connections, Dataview) through their APIs.

Current versions (2026-04-26): **`main` ships 0.3.10** (stable, 20 MCP tools, stdio+binary architecture as described above), **`feat/http-embedded` ships 0.4.0-alpha.4** (in-process HTTP server inside the plugin, no binary; native semantic search via Transformers.js; see § Branch protection policy below). License: MIT.

### Fork status

Active work happens on the **`istefox/obsidian-mcp-connector`** fork. Upstream `jacksteamdev/obsidian-mcp-tools` was officially declared unmaintained on 2026-04-24 (see issue #79); the maintainer recommended migration to MCP over HTTP and offered to link the upstream README to any successor plugin that uses HTTP transport AND is published in the official Obsidian community store.

### Branch protection policy (2026-04-25, set by Stefano)

**`main` is the production-ready, user-facing branch — currently 0.3.10. Treat it as protected.**

Active branches as of 2026-04-25:

| Branch | Version | Status | Use |
|---|---|---|---|
| `main` | **0.3.10** | **PROTECTED** — stable, BRAT users install this | Bug-fix patches only (0.3.x line) |
| `feat/http-embedded` | **0.4.0-alpha.4** | Active development — Phases 1+2+3 ✅ done, Phase 4 in progress (T1-T11 done; T12-T14 pending) | The HTTP-embedded pivot per `docs/design/2026-04-24-http-embedded-design.md` and `docs/plans/0.4.0-phase-{1,2,3,4}-*.md` |

**Hard rules — apply unless Stefano explicitly authorizes the specific action:**

1. **Never merge** `feat/http-embedded` (or any experimental branch) **into `main`**. The merge to 0.4.0 happens only when Stefano gives explicit go-ahead, after Phase 2-3-4 are complete and feature parity with 0.3.x is verified.
2. **Never force-push, rebase, or `reset --hard`** on `main` under any circumstance.
3. **Never delete or overwrite tags** on the 0.3.x line (0.3.0 through 0.3.10).
4. **Never delete the `0.3.x` GitHub releases** from the releases page.
5. Bug fixes against 0.3.x are welcome — branch from `main`, PR, merge as 0.3.8 / 0.3.9 etc. This pattern preserves the stable line; it does not replace it.
6. Merging `main` → `feat/http-embedded` (the inverse direction, to keep the dev branch aligned) is **safe and encouraged** — it does not touch `main`.

If a request seems likely to compromise `main`'s functionality, stop and ask before acting.

**These hard rules are also enforced as GitHub Rulesets (since 2026-05-05)** — three rulesets active on `istefox/obsidian-mcp-connector`:

- **`General`** (branch): targets `main` + `feat/http-embedded`, rules: Restrict deletions + Block force pushes. Enforces rule 2.
- **`main-strict`** (branch): targets `main` only, rule: Require pull request before merging (0 approvals). Enforces rule 1 — direct `git push origin main` without PR will be REJECTED.
- **`tags-protection`** (tag): targets pattern `0.*` (covers 0.1.x through 0.9.x), rules: Restrict updates + Restrict deletions + Block force pushes. Enforces rules 3 + 4.

Bypass list is empty on all three — admin (Stefano) is also subject to the rules. In a true emergency, the path is: temporarily disable the ruleset → perform the operation → re-enable. This adds friction = explicit awareness of destructive intent. Manage at https://github.com/istefox/obsidian-mcp-connector/settings/rules.

If you ever encounter a "GH013: Repository rule violations" error, the operation you attempted is structurally blocked because it violates one of these rules — investigate why before disabling protection. Don't disable rulesets to "make it work" without confirming the action is intended.

## Stack

| Layer | Tech |
|---|---|
| Monorepo | Bun workspaces (`bun.lock`) — **do not use npm/yarn/pnpm** |
| Toolchain pinning | `mise.toml` (bun latest) |
| Language | TypeScript 5, strict mode, `verbatimModuleSyntax: true` |
| Runtime validation | **ArkType** (`arktype` 2.0.0-rc.30) at every external boundary |
| MCP | `@modelcontextprotocol/sdk` 1.29.0 (fork) |
| UI | Svelte 5.17 inside the Obsidian plugin (patched — see `patches/svelte@5.16.0.patch`) |
| Reactive deps | RxJS 7.8 (polls other Obsidian plugins until loaded) |
| HTML→Markdown | Turndown 7.2 |
| Test | `bun:test` (native) |
| Format | Prettier 3 (`.prettierrc.yaml`) — 2-space indent, 80 col |
| Build | `bun build --compile` for the server binary, custom `bun.config.ts` for the plugin |
| CI | GitHub Actions (`.github/workflows/release.yml`) — cross-platform binaries + SLSA provenance |

Path alias inside every package: **`$/*` → `src/*`**. Use it instead of relative imports across feature boundaries.

## Commands

From the repo root. See each package's `package.json` for the full script list.

```bash
bun install                           # Install all workspace dependencies
bun run check                         # Type-check every package (tsc --noEmit)
bun run dev                           # Watch all packages in parallel
bun run release                       # Cross-platform release build
bun run version [patch|minor|major]   # Atomic version bump + commit + tag
```

Per-package notable scripts: `bun run inspector` in `packages/mcp-server` launches `@modelcontextprotocol/inspector` — **primary debugging tool** for server work. `bun run link` in `packages/obsidian-plugin` symlinks the built plugin into a local vault.

## Architecture

### Layout

- `packages/mcp-server/` — standalone MCP server, compiled to a binary
- `packages/obsidian-plugin/` — Obsidian plugin (TS + Svelte 5)
- `packages/shared/` — ArkType schemas, logger, cross-package types
- `packages/test-site/` — SvelteKit harness, not part of the shipped product
- `docs/` — architecture + feature specs (see References)
- `.clinerules` — **authoritative architecture contract, read first**

### Data flow

```
Claude Desktop
    │  stdio (JSON-RPC / MCP protocol)
    ▼
mcp-server binary                      (reads env OBSIDIAN_API_KEY at startup)
    │  HTTPS, self-signed cert, API key header
    ▼
Obsidian Local REST API plugin         (listens on 127.0.0.1:27124)
    │  in-process function calls
    ▼
Obsidian (vault, Templater, Smart Connections, Dataview)
```

The MCP server **never** touches the vault filesystem directly, even when it would be faster. Bypassing Obsidian corrupts its metadata cache and breaks live editing.

### Entry points

- **Server**: `packages/mcp-server/src/index.ts` → instantiates `ObsidianMcpServer` (`features/core/index.ts`), wires the stdio transport, fans out feature registration.
- **Plugin**: `packages/obsidian-plugin/src/main.ts` → `class McpToolsPlugin extends Plugin`, loads features via their `setup()` functions, registers the settings tab.
- **Shared**: `packages/shared/src/index.ts` → re-exports logger and types.

### Feature-based architecture

Every feature is a self-contained module in `src/features/<name>/` with a stable public shape (see `.clinerules` for the canonical spec):

```
feature/
├── components/   # Svelte UI (plugin only)
├── services/     # Business logic
├── constants/
├── types.ts      # ArkType schemas + TS types
├── utils.ts
└── index.ts      # Public API + setup function
```

Each `index.ts` exports a `setup()` that returns `{ success: true } | { success: false, error: string }`. A failing setup **must not** throw — return the error object so other features keep loading and the failure surfaces in the settings UI.

### Tool registration pattern (server)

Every MCP tool is declared with an ArkType schema + async handler through the shared `ToolRegistry` (never registered directly against the MCP SDK):

```typescript
tools.register(
  type({
    name: '"search_vault_smart"',
    arguments: {
      query: type("string>0").describe("A search phrase for semantic search"),
      "filter?": { /* ... */ },
    },
  }).describe("Human-readable tool description shown to the model"),
  async ({ arguments: args }) => {
    const data = await makeRequest(ResponseSchema, "/endpoint", { /* ... */ });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);
```

Rules:

- **Always** add `.describe()` on fields and on the top-level schema — that text becomes the model-facing documentation.
- Return MCP results shaped as `{ content: [{ type: "text", text: ... }] }`.
- Throw `new McpError(ErrorCode.*, message)` for protocol-level failures.
- **Boolean parameters arrive as strings** (`"true"`/`"false"`) from older MCP clients — `ToolRegistry` handles coercion centrally. Do not re-implement per tool; see `templates/index.ts` for an explicit `type("'true'|'false'")` workaround kept for belt-and-suspenders.
- Validate every untrusted JSON payload with ArkType first. Idiomatic pattern: `type("string.json.parse").pipe(schema)` — parses and validates in one expression. Use `.to()` to chain further transformations.
- **`ToolRegistry` is the only sanctioned way** to register tools and prompts. Do not register raw MCP handlers against the SDK directly. This is how boolean coercion, error formatting, and logging stay uniform.

## MCP surface (what this server exposes)

Capabilities declared: **`tools`** and **`prompts`**. No MCP resources are exposed.

### Tools (20 total)

**Vault file management** — `packages/mcp-server/src/features/local-rest-api/index.ts`:

| Tool | Purpose |
|---|---|
| `get_server_info` | Local REST API status + auth check. Only tool that works without auth. |
| `get_active_file` | Content of the currently active note (markdown or JSON with tags + frontmatter). |
| `update_active_file` | Replace content of the active note. |
| `append_to_active_file` | Append to the active note. |
| `patch_active_file` | Insert/modify content relative to a heading, block reference, or frontmatter field. |
| `delete_active_file` | Delete the active note. |
| `show_file_in_obsidian` | Open a note in the Obsidian UI (optionally in a new leaf); creates it if missing. |
| `list_vault_files` | List files in a directory (root by default). |
| `get_vault_file` | Read an arbitrary file from the vault. |
| `create_vault_file` | Create or overwrite a file. |
| `append_to_vault_file` | Append to an arbitrary file. |
| `patch_vault_file` | Heading/block/frontmatter-aware insert into a file. |
| `delete_vault_file` | Delete a file. |
| `search_vault` | Search via Dataview DQL or JsonLogic query. |
| `search_vault_simple` | Plain text search with context window. |

**Semantic search** — `features/smart-connections/index.ts`:

| Tool | Purpose |
|---|---|
| `search_vault_smart` | Semantic search delegated to the Smart Connections plugin (`/search/smart` endpoint registered by this repo's plugin). Supports folder include/exclude filters and result limits. |

**Templater integration** — `features/templates/index.ts`:

| Tool | Purpose |
|---|---|
| `execute_template` | Execute a Templater template with dynamic arguments, optionally creating a new file at `targetPath`. Arguments are validated dynamically from the template's parameter syntax. |

**Web fetch** — `features/fetch/index.ts`:

| Tool | Purpose |
|---|---|
| `fetch` | Retrieve any URL and return Markdown (via Turndown) or raw HTML. Supports pagination (`maxLength`/`startIndex`) with built-in truncation hint. |

**Command execution** — `features/commands/index.ts`:

| Tool | Purpose |
|---|---|
| `list_obsidian_commands` | Read-only discovery. Returns every command registered in the vault (core + plugins) with optional substring filter. Always safe, no permission gate. |
| `execute_obsidian_command` | Gated execution. Every call goes through a rate limiter (100/minute tumbling window) and then the plugin's `/mcp-tools/command-permission/` endpoint, which checks the master toggle + per-command allowlist. Disabled by default. The plugin-side soft warning threshold (default 30/min) is user-configurable via the Advanced disclosure in settings (`commandPermissions.softRateLimit`). |

### Prompts

Prompts are **dynamically discovered** from the vault, not hardcoded — see `features/prompts/index.ts`:

- Source directory: `Prompts/` at the vault root.
- A file becomes an MCP prompt only if it has the tag `#mcp-tools-prompt`.
- Prompt arguments are parsed from Templater template syntax in the file body (`parseTemplateParameters`).
- On `GetPrompt`, the server runs the template through `/templates/execute` (Templater plugin), strips frontmatter, and returns the result as a user message.

This means prompt schemas are **runtime data**: they depend on the user's vault contents and change when they edit a prompt note. Full reference in `docs/features/prompt-system.md`.

## Conventions

Full spec lives in `.clinerules`. Highlights:

- **TypeScript strict mode** everywhere, no exceptions. `verbatimModuleSyntax: true` — use `import type` for type-only imports.
- **Prefer functional over OOP.** Pure functions, single responsibility, action-oriented names (`installMcpServer`, `getInstallationStatus`).
- **Never reach the filesystem** from the server process except for logging. All vault access goes through `makeRequest()` → Local REST API.
- **Never use `console.log`** in production code — use the shared `logger` from `packages/shared/src/logger.ts` with a structured context object (`logger.error("message", { requestId, error })`).
- **Settings are augmented via TypeScript module augmentation**, not a central types file:
  ```typescript
  declare module "obsidian" {
    interface McpToolsPluginSettings {
      myFeature?: { /* ... */ };
    }
  }
  ```
- **ArkType validation at every boundary** — external fetch responses, REST endpoint payloads, MCP tool arguments, prompt frontmatter. Add `.describe()` to improve error messages.
- **Feature name kebab-case**, **function camelCase**, **type PascalCase**, **constant SCREAMING_SNAKE_CASE**.

## Gotchas

Active traps in the current tree. Historical bugs already fixed in the fork are in `git log` — don't clutter this list with them.

- **`patches/svelte@5.16.0.patch`** forces Svelte to use `index-client.js` instead of `index-server.js` — required for Bun bundler compatibility. Re-verify if you upgrade Svelte.
- **Self-signed HTTPS**: the server sets `process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"` inside `makeRequest.ts`. Removing or relocating this breaks every server→Obsidian call.
- **`packages/mcp-server/dist/`** is gitignored — CI regenerates binaries on tagged releases. Run `bun run build` locally for `dist/mcp-server`, or the per-target scripts (`build:mac-arm64`, `build:mac-x64`, `build:linux`, `build:windows`), but never commit the output.
- **Version bumps must go through `bun run version`** — it atomically updates `package.json`, `manifest.json`, `versions.json` and creates the git commit + tag. Manual edits get out of sync.
- **`packages/obsidian-plugin/main.js` is written at the package root, not `dist/`** — Obsidian expects that path. Do not move it.
- **External modules in `bun.config.ts`** (`obsidian`, `@codemirror/*`, `@lezer/*`) must stay external. Bundling them breaks the plugin on load.
- **Version macro** in `features/version/index.ts` uses Bun's `with { type: "macro" }` / `with { type: "json" }` import attribute — works on Bun's compile path, will break under plain tsc emit.
- **Smart Connections compatibility**: the plugin wrapper handles both v2.x (`window.SmartSearch`) and v3.0+ (`smartEnv.smart_sources`). Preserve both code paths when modifying.
- **`execute_template.createFile`** is typed as the string `"true"|"false"` (not boolean) because older MCP clients serialize booleans as strings — explicit workaround in `features/templates/index.ts`, kept as belt-and-suspenders for SDK 1.29.0.
- **`plugin.loadData()` / `plugin.saveData()` are NOT atomic** — default Obsidian persistence is two independent async calls. Any feature doing `load → modify → save` in response to concurrent events MUST serialize with a mutex. See `features/command-permissions/services/settingsLock.ts` for the canonical implementation + 35-way regression test.
- **Command-permission policy invariants** — `features/command-permissions/` is the security boundary for `execute_obsidian_command`. Whenever you touch `permissionCheck.ts`, preserve these load-bearing properties: (1) **deny by default** — `enabled !== true` short-circuits to deny BEFORE any allowlist check; (2) **two-phase mutex** — Phase A (load + decide-or-detect-modal-needed + save-on-fast-path) holds the lock; modal wait runs OUTSIDE the lock; Phase B (re-load + persist final outcome) re-acquires it, so concurrent requests serialize their I/O without serializing user interaction; (3) **the destructive heuristic is a nudge, not a gate** — matching commands disable "Allow always" but "Allow once" still works; presets in `presets.ts` MUST exclude every word the regex catches; (4) **allowlist entries are exact ids** — no wildcard support, deliberate. The full threat model and option matrix lives in `docs/design/issue-29-command-execution.md` — read it before changing the policy shape.
- **Every `from "obsidian"` import in `packages/shared/` must be `import type`.** The npm `obsidian` package ships only `.d.ts`; Obsidian injects the runtime module at plugin load. A value import survives `verbatimModuleSyntax` and fails `bun build --compile` with `Could not resolve "obsidian"`. The `packages/obsidian-plugin/` package is fine — value imports there are legitimate.

## Testing & CI

- Framework: `bun:test` (`import { describe, expect, test } from "bun:test"`).
- Tests live next to the code (`*.test.ts`). Run a single file with `bun test <path>`; run a whole package with `cd packages/<name> && bun test`. There is no monorepo-wide fan-out today — run `bun run check` from the root, then `bun test` in each package.
- **Plugin test infrastructure**:
  - `packages/obsidian-plugin/bunfig.toml` — `[test] preload` registers a synthetic `"obsidian"` module via `src/test-setup.ts`, so tests can import production modules that reference `Plugin`, `Notice`, `FileSystemAdapter`, `TFile`, etc.
  - `packages/obsidian-plugin/src/test-setup.ts` — the module mock. `FileSystemAdapter` accepts an optional `basePath` for anchoring tests at a real temp directory. Production code never constructs it itself — Obsidian does — so the extra parameter is invisible to the ship build. Also stubs `Modal` (shallow base class with `onOpen`/`onClose` plumbing) and the `svelte` module's `mount`/`unmount` as recorders — every call is published on `globalThis.__svelteMockCalls.{mount,unmount}` so tests can both inspect component props (including callback handles like `onDecision`) and assert mount/unmount pairing. Tests that use these helpers must reset `__svelteMockCalls` in `beforeEach` for isolation.
  - `packages/obsidian-plugin/.env.test` — fake `GITHUB_DOWNLOAD_URL` / `GITHUB_REF_NAME` for the build-time `environmentVariables()` macro. Bun auto-loads when `bun test` runs.
  - **Stubbing `os.homedir()`**: use `spyOn(os, "homedir").mockReturnValue(tmpRoot)` — Bun/Node cache HOME early, so runtime `process.env.HOME = …` is not reliable. See `config.test.ts` and `uninstall.test.ts`.
  - **Installer integration tests** use real shell scripts as fake binaries (tmpdir, `mode: 0o755`) instead of mocking `child_process.exec`. See `status.integration.test.ts`. macOS-guarded (shebang approach is Unix-only).
- **Still uncovered**: `installMcpServer` orchestration wrapper, `downloadFile` (HTTP + stream), Svelte component rendering (covered only by `svelte-check` and manual `bun run link` smoke tests).
- CI: `.github/workflows/release.yml` triggers on tag push, runs `bun run release`, cross-compiles all platforms, generates SLSA provenance, uploads release artifacts. **No test step in CI yet** — keep tests green locally before merging to `myfork/main`.

## Pre-commit checklist

**For any change:**

1. **`bun run check`** (at repo root) — TypeScript strict check across all packages. Must pass.
2. **Never bump version fields by hand.** Use `bun run version [patch|minor|major]`.

**For changes in `packages/mcp-server/`:**

3. **`bun test`** — existing tests must pass. Add tests when touching parsing or conversion logic.
4. **`bun run inspector`** — verify new/modified tools register correctly, expose the expected schema, return well-formed MCP results.

**For changes in `packages/obsidian-plugin/`:**

3. **`bun run build`** from the package — a clean prod build must succeed.
4. **Manual integration test** — `bun run link` into a throwaway vault, enable the plugin, verify: server install flow, Claude Desktop config write, REST endpoint registration, settings UI. Type checks do not catch UI or install-flow regressions.

**For changes in `packages/shared/`:**

3. **`bun run check` at the repo root** (again) — shared-package changes cascade; both runtime packages must still type-check.

## Project status (2026-04-26)

Upstream `jacksteamdev/obsidian-mcp-tools` is **officially unmaintained** (declared by @jacksteamdev on issue #79 the 2026-04-24). Recommendation: migrate to MCP over HTTP. Conditional offer: link to any plugin that uses HTTP transport AND is published in the Obsidian community store.

Current state of the fork:

- `main` at **0.3.10**, stable, on BRAT, fully functional (all 20 MCP tools). Protected per the policy above.
- `feat/http-embedded` at **0.4.0-alpha.4**, Phases 1+2+3 complete + Phase 4 Block A (migration core) + Block B (client config UI) + Block C (modal + first-load wiring) + Block D (Node detection + mcp-remote pre-warm) + Block E.partial (CI on-PR workflow added; release.yml simplification deferred to T14). End-to-end semantic search via Transformers.js verified in vault TEST. Migration UX detects 0.3.x state and offers an opt-in modal at first load.
- Community plugin store submission `obsidianmd/obsidian-releases#11919` open since 2026-04-13, automated lint cleared on 2026-04-18, awaiting human review.

## Pending work

Items in flight, ordered by priority:

1. **Phase 4 — closing tasks** (`feat/http-embedded`): T12 documentation pass (this commit covers the README "0.4.0 alpha" notice and CLAUDE.md status; full README rewrite + CHANGELOG collapse deferred to T13/T14), T13 0.4.0-beta.1 cut after manual E2E matrix, T14 0.4.0 stable + store PR #11919 update + upstream README PR + Discord DM to @jacksteamdev (per his stated conditions).
2. **Discord DM to @jacksteamdev**: gated on T14 (0.4.0 stable + community store listing live).
3. **Weekly check on store PR #11919** automated via routine `trig_015yL8D3VNao7nhRKjBu95ZK` (Mondays 07:00 UTC = 09:00 Rome CEST / 08:00 Rome CET). Notifies on real activity, silent on quiet weeks. Three older overlapping routines (`trig_01Lpi3a8jHiisxjDN22D5FSX` weekly duplicate, `trig_011d3JKRDd5v2mvm5wJgyAfB` and `trig_01HnQUut4yNKn3NNMArJSkWH` daily duplicates) disabled 2026-04-25. The hourly issue #79 watcher (`trig_01Dx8sZTD78yBj7buuVYP9KE`) remains active for orthogonal scope.

Items resolved and out of "pending":

- ~~`#3` installer 404 — fixed in 0.3.5, validated by @Metal0gic.~~
- ~~Maintainership stance — settled by jacksteamdev's 2026-04-24 declaration; we are the continuation maintainer.~~
- ~~Binary content types for `get_vault_file` — landed in 0.3.4 (#59).~~
- ~~Phase 1 — HTTP transport infrastructure — landed in 0.4.0-alpha.1.~~
- ~~Phase 2 — Tool handler migration — landed in 0.4.0-alpha.2/alpha.3.~~
- ~~Phase 3 — Native semantic search — landed in 0.4.0-alpha.3 / fixed in alpha.4 (`bun.config.ts` redirect onnxruntime-node→onnxruntime-web for Electron renderer).~~

## Soak preflight: chain identification first

When a soak round comes in (folotp / marcoaperez / grimlor / any external tester), confirm **which MCP path the client is actually exercising before interpreting any verdict**. The fork now ships in two distinct architectures (`0.3.x` legacy stdio binary + Local REST API + `markdown-patch`, vs. `0.4.x` in-process HTTP-embedded), and a tester can have both installed simultaneously: the legacy upstream `~/Library/Application Support/obsidian-mcp-tools/bin/mcp-server` persists from any pre-fork install unless explicitly deleted, and `claude_desktop_config.json` is not auto-rewritten by the fork install. A tester who BRAT-pinned the fork on top of a `0.3.x` upstream install can have Cowork/Claude Desktop routing through the legacy binary while the fork plugin is concurrently loaded — which makes any verdict about "the fork's behavior" suspect until the chain is identified.

Three discriminators, applied as a first-line check in any soak comment **before** posting verdicts:

1. **Process inventory** — `ps aux | grep -E 'mcp-server|mcp-remote'`. Legacy stdio chain shows the upstream binary process; HTTP-embedded chain shows `npx mcp-remote` (or no bridge process at all if the client speaks streamable-http natively).
2. **`get_server_info` shape** — call the tool from the client. **Legacy chain returns `apiExtensions[]`** (the LRA extension manifest list); **HTTP-embedded returns no `apiExtensions` field** (the in-process server doesn't expose LRA's manifest concept). Field absence is a positive HTTP-embedded marker.
3. **Tool namespace prefix on the client side** — `mcp__obsidian-mcp-tools__*` (legacy upstream binary) vs. `mcp__mcp-tools-istefox__*` (HTTP-embedded fork plugin). Visible in the client's tool list before any tool is called.

A soak verdict that doesn't cite at least one of these as confirmed-positive for the intended chain is provisional. The 2026-05-04 round-3 soak by folotp on `0.4.0-beta.3` mis-attributed three of its verdicts (H2-root reject, block-in-table reject, `#74` double-prefix) because the chain identification was inferred from `claude_desktop_config.json` content rather than runtime-checked; the disconnect was traced via `jacksteamdev/obsidian-mcp-tools#83`. Two of the three turned out to be real `0.4.x` regressions (filed as `#80`, `#81`), one was a legacy-chain-only artifact (`#74` resolution). Three lost cycles because the chain wasn't pinned at the start.

When you ask a tester to soak a candidate cut (BRAT-pin or beta tag), include the three discriminator checks as part of the report template. When you read a soak report, scan for chain identification first; if absent, ask before drafting verdicts.

## Outreach triage methodology

### Foundational principle: read fully, analyze deeply, take the time

**Before posting any reply, comment, follow-up, or triage on any GitHub thread (fork or upstream — issues, PRs, review comments, all of them), read the entire thread end-to-end and analyze it.** This is non-negotiable and supersedes every rule below; the rules are concrete instances of this principle, not substitutes for it. Stefano has flagged this expectation explicitly after a cluster of failure modes in a single 24-hour window: "i post, gli issues ecc... vanno letti interamente ma soprattutto **analizzati**! prenditi il tempo che vuoi, ma vanno analizzati a fondo!" Take that as standing instruction for every outreach action, not just the ones that look ambiguous.

What "read fully + analyze" means in practice:

- **Read the issue/PR body in full**, including code blocks, hyperlinks, referenced design docs, and screenshots.
- **Read every prior comment** in the thread chronologically. Identify who has authority on what (upstream maintainer, dependency maintainer, original reporter, validated contributor) and what they have already established as fact, retracted, or refined.
- **Map the state**: what is settled, what is open, what is disputed, who is asking what of whom — before drafting your reply.
- **For technical claims**, run the targeted code grep + hand-trace yourself. Don't infer behaviour from the comment author's framing alone.
- **If an offer is multi-point or structured**, enumerate the points before drafting; ensure the reply addresses each.

There is **no time pressure** on outreach or triage. Take whatever time is required. The cost of a 5-minute deeper read is one session-time unit; the cost of posting on a misread thread is a relationship with a domain authority + a follow-up correction + an entry in this rule list. The concrete rules below all exist because of failures of this foundational principle in a single 24-hour window. If this principle is followed, the others mostly take care of themselves.

### When triaging an upstream issue or any candidate for cross-link outreach

**Never skip without informed evidence.** Before marking a candidate as "skip", apply these two checks in order:

1. **Read the full issue body.** Excerpt-level reading misses substance — the asker's context, the bug shape, the specific repro that may already be addressed in the fork. Comment counts and labels are not enough.
2. **Targeted code grep on the fork.** When the claim is technical (parser bug, transport issue, tool behaviour), grep for the load-bearing function and hand-trace against the asker's fixture. A 5-minute trace beats a "cannot verify" assumption.

If **both** checks fail to unblock an informed position, skip is justified — and frame any comment to future-you that way ("did not verify"). If **either** unblocks one, engage with the confidence the evidence supports.

### Sweep enumeration rule

When doing a periodic sweep of upstream issues / PRs, **enumerate `state=open` without `since=` filter**. Filtering by recent activity excludes old-but-still-open items that have been languishing without engagement — exactly the long-tail audience most receptive to a redirect to the maintained fork. The 2026-05-04 deep review surfaced 10 never-commented items (3 issues + 7 PRs, including a 2025-05 multi-vault PR and a 2025-07 NFS-symlink bug) that the prior `since=2026-04-29` sweep had hidden. Use `gh api '/repos/.../issues?state=open&per_page=100' --jq 'sort_by(.number) | .[] | …'` for the canonical full inventory.

### Stale-claim audit on prior outreach

When a major release event happens (architecture pivot, stable cut, deprecation), audit prior outreach comments for claims that are no longer true under the new release. The 2026-04-21 outreach script template said "fixed in v0.3.0" for #61 (toolToggle), which was accurate at the time, but the 0.4.0 architecture pivot **hid the toolToggle UI** (Known limitations entry) — leaving the prior comment misleading for users who BRAT-default-installed `0.4.x` after the cut. Don't rewrite history; post a follow-up with the version-specific delta. Cheap honesty, prevents user disappointment downstream.

### Validated-contributor engagement rule

When a fork issue is **OPEN, authored by a validated maintainer-grade contributor (folotp / marcoaperez / grimlor)**, and has **zero comments after >12h**, treat it as engagement-priority regardless of whether you've been pinged. These contributors invest meaningful effort into proposals; silence past the 12h mark reads as drop signal even if the issue is "future scope, no commitment". Post a substantive triage comment within the next session: technical preference between proposed options, implementation footprint estimate, timeline expectation framed against current gating constraints. The comment doesn't have to commit to a milestone — but it has to engage with the substance. The 2026-05-04 fork #77 (folotp's partial-read RFC) was sat for ~13h with the `enhancement` label and no other action because the prior session's triage note ("future scope, no commitment") was inherited as a passive-monitor signal in the next session's sweep; that framing was wrong. "Future scope" gates milestone commitment, not engagement.

### Authority disambiguation rule

When triaging or following up on a third-party issue, **read the full comment thread, not just the issue body**. If a **domain authority** has already disambiguated the framing in a prior comment — typically: the maintainer of an upstream dependency mentioned in the report (e.g. `coddingtonbear` on Local REST API issues), the original bug reporter retracting or refining the claim, or the upstream maintainer (`jacksteamdev`) on his own repo — your reply MUST acknowledge that disambiguation, not re-assert the original framing.

Re-asserting after a domain authority has corrected the framing reads as either inattention or insistence, both of which damage relationships with the people whose project you're indirectly building on. The 2026-05-04 stale-claim follow-up on `jacksteamdev/obsidian-mcp-tools#68` posted "the `apiExtensions` / `certificateInfo` validation that broke against LRA `v3.4.x`" — but `coddingtonbear` (LRA maintainer) had already replied 2026-02-22 explaining that nothing changed in LRA `v3.4.x` and the missing fields were the documented response shape for unauthenticated requests. The 2026-04-21 batch had also missed this. A second follow-up was needed to acknowledge the LRA maintainer's authoritative read and correct the record. Concrete check before posting: skim every prior comment in the thread, look specifically for replies from people whose repo or project is referenced in the issue body, and if they've spoken authoritatively, mirror their framing in yours.

### Multi-point offer acknowledgement rule

When a validated contributor makes a **multi-point engagement offer** (test bench with multiple deliverable types, fixture variants on request, verify-before-cut commitment, etc.), the response needs two layers, both explicit:

1. **Preamble — explicit thanks for the offer shape itself**, said out loud rather than folded implicitly into the technical reply. High-investment engagement offers (continuous test bench, expanded fixture sets on demand, verify-before-cut commitment) carry a symbolic-acknowledgement cost that a purely-technical reply doesn't pay; the contributor invested effort signalling commitment, and the implicit-thanks-via-engagement loop only closes if the symbolic side is acknowledged separately. Articulate **what about the engagement shape is load-bearing for the project** — not generic gratitude.
2. **Point-by-point acceptance**: enumerate accepted points 1, 2, 3 in the same order the contributor wrote them; pin scope per-point; link to the current flow context (e.g. "default order: wait for disambig step X, then either Y or Z").

Implicit single-point responses to multi-point offers read as engagement loss — the contributor invested effort enumerating each commitment, and a generic "happy to ship X" reply only acknowledging one of them silently drops the others. The 2026-05-04 reply on `jacksteamdev/obsidian-mcp-tools#83` paraphrased one of folotp's three offer points (debug build) into a narrower scope (`vault.on('modify')` instrumentation only, not the boundary-scan instrumentation he'd specifically asked for) and didn't acknowledge the other two (verify-4-variants-before-cut, additional-variants-on-request) **or** the test-bench offer shape itself. Two follow-ups were needed to repair: one for point-by-point acceptance, a separate one for the explicit thanks. Doing both in the original reply would have been one message.

**Why these rules exist:** the 2026-05-04 outreach round initially skipped two candidates on weak grounds — `jacksteamdev/obsidian-mcp-tools#83` (claimed "couldn't verify the fix" before reading `patchHelpers.ts:442`) and `#85` (mistaken "marketing-bait" before reading the full body, which was substantive peer-dev design questions). Both turned around on a 5-minute deeper look. The same-day deep re-analysis then surfaced 10 never-commented items the morning sweep had missed (since-filter blind spot), 1 stale Group B claim (#61 toolToggle in 0.4.0), 1 missed engagement on a high-quality validated-contributor proposal (#77 sat 13h with no triage comment), 1 multi-point engagement offer answered with a single-point reply (#83 reply paraphrased one of folotp's three offer points and silently dropped the other two), and 1 stale-claim follow-up that re-asserted a misframing the LRA maintainer had already corrected on the thread (#68 follow-up ignored `coddingtonbear`'s 2026-02-22 reply and propagated the "LRA changed at v3.4.x" framing for the second time). Lazy skip + filtered enumeration + un-audited prior comments + inherited passive-monitor framing + asymmetric reply to multi-point offers + un-read prior comments by domain authorities each cost reach.

## References

**In-repo docs** (read before implementing a new feature):

- `.clinerules` — authoritative feature architecture, ArkType conventions, error handling contract.
- `docs/project-architecture.md` — monorepo overview (aligned with `.clinerules`).
- `docs/features/mcp-server-install.md` — installer feature spec.
- `docs/features/prompt-system.md` — authoritative reference for the prompt feature. Read before touching `packages/mcp-server/src/features/prompts/` or the template execution endpoint in the plugin.
- `docs/design/issue-29-command-execution.md` — fork design review for Obsidian command execution (threat model, policy options, phased plan). Authoritative when resuming issue #29 / PR #47.
- `CONTRIBUTING.md`, `SECURITY.md`.

**Live project state**:

- [Open issues](https://github.com/jacksteamdev/obsidian-mcp-tools/issues) / [Open PRs](https://github.com/jacksteamdev/obsidian-mcp-tools/pulls) — always cross-check GitHub for anything landed since.
- Discord `#maintainers` channel (invite in README) — low traffic, contains root-cause analysis for `patch_vault_file`.
- [Jason Bates fork](https://github.com/JasonBates/obsidian-mcp-tools), commit [`8adb7dd`](https://github.com/JasonBates/obsidian-mcp-tools/commit/8adb7dd0e1c47081f15908950b89e96b7417d12a) — unsubmitted `resolveHeadingPath` fix, cherry-pick source of truth if the heading-path logic needs more work.

**Upstream dependencies worth knowing**:

- [Model Context Protocol spec](https://modelcontextprotocol.io) — for boolean/schema shape gotchas.
- [Obsidian Local REST API plugin](https://github.com/coddingtonbear/obsidian-local-rest-api) — the HTTPS bridge this server depends on.
- [Local REST API OpenAPI reference](https://coddingtonbear.github.io/obsidian-local-rest-api/) — especially `PATCH /vault/{filename}`, whose header-based request format is hard to generate correctly.
