# ADR-0006 — MCP Prompts capability (in-process server)

- **Status**: Accepted
- **Date**: 2026-05-27
- **Target release**: 0.9.0
- **Scope**: `prompts/list`, `prompts/get`, `notifications/prompts/list_changed`
  for the in-process streamable-HTTP MCP server. Tool count unchanged (43).

---

## Context

The 0.8.x server declares only `tools: {}` in its capabilities object. The
`prompts` capability is undeclared; `prompts/list` and `prompts/get` handlers
are absent. MCP clients that enumerate capabilities (Claude Desktop, Claude
Code, Zed) therefore offer no slash-command UI for vault prompts, even though
the vault-side contract (`Prompts/` folder + `#mcp-tools-prompt` tag) has been
documented since 0.3.x and `PromptFrontmatterSchema` / `PromptMetadataSchema`
already exist in `packages/shared/src/types/prompts.ts`.

The 0.3.x retired binary (`packages/mcp-server`) contained a working
`setupObsidianPrompts()` that drove discovery and execution through Local REST
API HTTP calls. That path is incompatible with the in-process architecture: the
in-process server calls `app.vault.*` and `app.metadataCache.*` directly, never
through HTTP. A straight port of the old handler is ruled out.

Two structural decisions are non-trivial and have architectural impact:

1. **How to extend `ToolRegistry`** for prompt handlers without violating the
   "ToolRegistry is the only sanctioned registration path" invariant.
2. **Whether `notifications/prompts/list_changed` is deliverable** given the
   per-request (stateless) `McpServer` lifecycle.

---

## Decision

### 1. A parallel `PromptRegistry` extends the single-registration-path invariant

`ToolRegistry` is a typed `Map<Schema, Handler>` whose generics are bound to the
`{name, arguments}` tool request shape. Prompt handlers are keyed differently:
`prompts/list` takes no parameters; `prompts/get` takes `{name, arguments?}`.
Forcing prompts into the existing `ToolRegistry` type would require widening its
generics or introducing a discriminated union, both of which would pollute the
boolean-coercion and `disableByName` tool-specific logic.

The chosen approach introduces a `PromptRegistry` class in
`src/features/mcp-transport/services/promptRegistry.ts` that mirrors
`ToolRegistry`'s lifecycle pattern (`list`, `dispatch`) but is typed for the
MCP prompt protocol surface. It is wired into `mcpServer.ts` at the same call
site where `ToolRegistry` is wired:

```ts
server.server.setRequestHandler(ListPromptsRequestSchema, promptRegistry.list);
server.server.setRequestHandler(GetPromptRequestSchema, (req) =>
  promptRegistry.dispatch(req.params),
);
```

`ToolRegistry` is unchanged. The "single sanctioned path" invariant is upheld
because both registries are the only path to attach handlers to the SDK server.
No feature may call `server.server.setRequestHandler` directly for prompts.

The `PromptRegistry` is created once in `createMcpService` alongside
`ToolRegistryClass`, passed to a `registerPrompts(registry, ctx)` function in
`src/features/prompts/index.ts`, and shared across per-request `McpServer`
instances (same pattern as `ToolRegistry`).

### 2. Vault-side discovery: regex parser, not AST

The retired binary used `acorn` AST to parse `tp.mcpTools.prompt()` calls. The
SPEC defines a single pattern that the regex approach covers completely:

```
/<% tp\.mcpTools\.prompt\("([^"]+)",\s*"([^"]*)"\) %>/g
```

This eliminates a runtime dependency (`acorn`) with no loss of correctness for
the defined vault contract. The regex is encapsulated in
`promptDiscovery.ts::parseArgDeclarations()`.

Frontmatter is parsed via `app.metadataCache.getFileCache(file)?.frontmatter`
(zero HTTP calls; consistent with how all other in-process tools read
frontmatter). `PromptFrontmatterSchema` from `packages/shared` validates the
`tags` field at the boundary.

### 3. Argument substitution: `{{arg}}` Mustache-style, no Templater execution

The 0.3.x path called `POST /templates/execute` to render the body through
Templater, which allowed full Templater expression evaluation. The SPEC
explicitly excludes Templater execution for the in-process implementation: the
`{{arg_name}}` substitution is a simple `String.prototype.replace` over the
body after stripping `<% tp.mcpTools.prompt(...) %>` lines. Missing args leave
their placeholder in place. Templater-specific syntax in the body (`<%* ... %>`,
date helpers, etc.) is returned verbatim — the client receives the raw
Templater source, which is the correct graceful degradation when Templater
execution is out of scope.

This removes the Templater optional-dependency from the prompts feature path
entirely, making `prompts/get` available even in vaults without Templater.

### 4. `notifications/prompts/list_changed` in stateless mode

The server uses `sessionIdGenerator: undefined` (stateless streamable-HTTP).
Each HTTP request creates a new `McpServer` + `StreamableHTTPServerTransport`,
handles the request, and destroys both. There is no persistent connection on
which to push notifications between requests.

`sendPromptListChanged()` internally calls `this.server.notification(...)`,
which throws `"Not connected"` when no transport is live. The vault watcher
registers `vault.on('create'|'rename'|'delete')` and calls a
`notifier: () => void` injected at setup time. In `createMcpService` this
notifier is a no-op (stateless mode has nothing to push to). The vault watcher
still registers and tears down correctly; the notifier call is silently swallowed.

This behavior is correct: stateless MCP clients re-poll `prompts/list` on their
own schedule. The vault watcher infrastructure is in place for a future session-
aware transport without changing the feature contract.

### 5. Feature module: `src/features/prompts/`

```
src/features/prompts/
├── services/
│   ├── promptDiscovery.ts   # list + parseArgDeclarations()
│   ├── promptRenderer.ts    # stripArgDeclarations() + substituteArgs()
│   └── vaultWatcher.ts      # vault event → notifier()
└── index.ts                 # setup(), teardown(), registerPrompts()
```

`setup(server, app)` is called from `main.ts` after `mcpTransportSetup`. It:
1. Calls `createMcpService`'s returned `McpService` to obtain a `PromptRegistry`
   reference (McpService gains a `promptRegistry` field alongside `registry`).
2. Registers handlers via `registerPrompts(promptRegistry, { app })`.
3. Starts the vault watcher with a no-op notifier.

`teardown()` calls `vaultWatcher.stop()` which calls `vault.offref(ref)` on all
registered event refs. No other cleanup is needed.

`main.ts` calls `promptsFeatureTeardown()` in `onunload`, symmetrically with
`mcpTransportTeardown`.

---

## Alternatives considered

### A. Fold prompts into `ToolRegistry` via a discriminated union

Widen `ToolRegistry`'s schema generic to accept both `{name, arguments}` (tools)
and `{method: 'prompts/list'|'prompts/get', ...}` (prompts). Rejected: the
boolean-coercion logic, `disableByName`, `normalizeInputSchema`, and the `list()`
response shape are all tool-specific. A union would require conditional branches
throughout `ToolRegistryClass`, growing its responsibility beyond the single-
concern boundary. The resulting type complexity also breaks the `register()` call
sites' type inference.

### B. Direct `server.server.setRequestHandler` in `mcpServer.ts`

Register prompt handlers inline in `handleRequest`, calling vault APIs directly
from the closure. Rejected: this spreads vault access logic into the transport
layer, violates the feature-based architecture (every feature in its own
`src/features/<name>/`), and makes the handlers untestable in isolation
(they would be inner functions with no exported seam). It also defeats the
"single sanctioned registration path" invariant's purpose, which is uniform
logging and error formatting.

### C. Retain Templater execution for `prompts/get`

Use the existing `executeTemplateHandler` (or the `registerTemplatesCompatRoute`
LRA shim) to render the prompt body before returning it. Rejected: the SPEC
explicitly excludes Templater execution; doing so would require Templater to be
installed and enabled, reintroducing the optional-dependency surface and the
associated error paths. The Mustache-style `{{arg}}` substitution covers the
stated scope and is simpler to test.

---

## Consequences

**Positive**
- `prompts/list` and `prompts/get` work without Templater installed.
- `ToolRegistry` is unchanged — no regression risk to the 43 existing tools.
- The `vaultWatcher` teardown contract prevents listener leaks on plugin reload.
- `packages/shared/src/types/prompts.ts` is reused without modification.

**Negative**
- `notifications/prompts/list_changed` is a structural no-op in stateless mode.
  Clients must re-poll; there is no push. Documented as a known limitation.
- Templater expressions in prompt bodies (date helpers, file ops) are returned
  verbatim rather than executed. Users who relied on Templater evaluation in
  0.3.x prompts must adjust their prompt files.

**Neutral**
- `PromptRegistry` is a new class (~80 lines) with its own test surface.
- `McpService` gains a `promptRegistry` field; callers that only read `registry`
  are unaffected (additive).
- `docs/features/prompt-system.md` must be updated to reflect the in-process
  execution model (no Templater, no HTTP, `{{arg}}` substitution).

---

## References

- SPEC.md — functional requirements and data model
- `packages/shared/src/types/prompts.ts` — `PromptFrontmatterSchema`,
  `PromptMetadataSchema`, `PromptParameter`
- `src/features/mcp-transport/services/mcpServer.ts` — per-request server
  pattern and `ToolRegistry` wiring (model for `PromptRegistry` wiring)
- `src/features/mcp-transport/services/toolRegistry.ts` — `ToolRegistryClass`
  (parallel structure for `PromptRegistry`)
- `docs/features/prompt-system.md` — authoritative vault-side contract
- MCP spec §4.3 Prompts — `prompts/list`, `prompts/get`, capability declaration
