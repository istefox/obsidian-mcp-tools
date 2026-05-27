# SPEC: MCP Prompts feature for in-process server

## Objective

Wire the `prompts` capability into the in-process streamable-HTTP MCP server
(0.4.x). The server currently declares no `prompts` capability and registers
no `prompts/list` or `prompts/get` handlers. After this change, prompt files
in the vault's `Prompts/` folder surface as slash-commands in MCP clients
(e.g. `/mcp__mcp-tools-istefox__my-prompt` in Claude Code).

## Scope

**In scope:**

- Declare `prompts` capability on the MCP server.
- `prompts/list` handler: scan `Prompts/` folder, filter by `mcp-tools-prompt`
  tag, parse argument declarations, return MCP prompt list.
- `prompts/get` handler: read prompt file, strip argument declarations, substitute
  `{{arg_name}}` placeholders with provided values, return as user message.
- `notifications/prompts/list_changed`: vault event watcher on `Prompts/` that
  triggers client notification on file create / rename / delete.
- New feature module `src/features/prompts/` with `setup()` / `teardown()` contract.

**Out of scope:**

- Templater execution for `prompts/get` (no Templater dependency).
- Subfolders under `Prompts/` (flat directory only, per existing vault contract).
- New vault-side file format changes (re-use the existing `tp.mcpTools.prompt`
  declaration syntax and `mcp-tools-prompt` tag).
- `prompts/listChanged` subscription tracking (server sends; clients subscribe
  at their own discretion).

## Stack

TypeScript strict mode, Bun workspace, `bun:test`. Obsidian plugin runtime
(in-process, no separate binary). `@modelcontextprotocol/sdk` 1.29.0. ArkType
for frontmatter validation at the boundary. No new npm dependencies.

## Architecture

### Feature layout

```
src/features/prompts/
├── services/
│   ├── promptDiscovery.ts   # list + parse arg declarations
│   ├── promptRenderer.ts    # strip declarations + substitute args
│   └── vaultWatcher.ts      # subscribe vault events → listChanged notification
└── index.ts                 # setup(), teardown(), handler registration
```

### Integration points

- `src/main.ts` — calls `promptsFeature.setup(server, app)` during plugin `onload`.
- `src/features/mcp-transport/` — server must declare `{ prompts: {} }` in its
  capabilities object alongside the existing `tools` capability.
- `ToolRegistry` — handlers registered through the existing registry (consistent
  with the "single registration path" invariant in CLAUDE.md).

### Data flow

**`prompts/list`:**
```
app.vault.getMarkdownFiles()
  → filter path prefix "Prompts/"
  → filter tag "mcp-tools-prompt" via metadataCache.getFileCache()
  → for each file: cachedRead → parseArgDeclarations()
  → return PromptListEntry[]
```

**`prompts/get(name, args)`:**
```
find file by name (filename without extension → prompt name)
  → cachedRead
  → stripFrontmatter()
  → stripArgDeclarations()   # remove <% tp.mcpTools.prompt(...) %> lines
  → substituteArgs(body, args)  # {{arg_name}} → provided value; unknown keys left as-is
  → return { messages: [{ role: "user", content: { type: "text", text: body } }] }
```

**`notifications/prompts/list_changed`:**
```
vault.on('create' | 'rename' | 'delete')
  → if path starts with "Prompts/" and ends with ".md"
  → server.sendPromptListChanged()
```

## Data model

### Vault-side prompt file (existing contract, read-only)

```markdown
---
tags:
  - mcp-tools-prompt
description: "Optional description for MCP clients"
---
<% tp.mcpTools.prompt("topic", "The subject to explain") %>
<% tp.mcpTools.prompt("level", "Target audience level") %>

Explain {{topic}} at {{level}} level.
```

### Argument declaration parsing

- Pattern: `/<% tp\.mcpTools\.prompt\("([^"]+)",\s*"([^"]*)"\) %>/g`
- First capture: argument name (maps to `{{name}}` placeholder).
- Second capture: argument description (exposed in MCP `PromptArgument.description`).
- Declarations stripped from the rendered body before substitution.

### MCP `PromptListEntry` shape

```typescript
{
  name: string;          // filename without extension
  description?: string;  // frontmatter "description" field, if present
  arguments: Array<{
    name: string;
    description: string;
    required: false;     // graceful passthrough — never hard-fail on missing arg
  }>;
}
```

### Prompt name derivation

`filename (no extension)` — no slug transformation. File `Prompts/My Prompt.md`
→ name `"My Prompt"`. Clients may display or slugify as they wish.

## API

### `prompts/list`

- No parameters.
- Returns all files in `Prompts/` (vault root only) with tag `mcp-tools-prompt`.
- Empty list when `Prompts/` does not exist — no error.
- Argument declarations parsed from cached file content.

### `prompts/get`

- Parameters: `{ name: string; arguments?: Record<string, string> }`.
- Lookup: find `Prompts/<name>.md` (exact, case-sensitive).
- `McpError(ErrorCode.InvalidParams)` if file not found or tag absent.
- Missing `arguments` or absent key → placeholder left in body (no error).
- Response: `{ messages: [{ role: "user", content: { type: "text", text: string } }] }`.

### `notifications/prompts/list_changed`

- Sent when a `.md` file is created, renamed into/out of, or deleted within `Prompts/`.
- One notification per vault event (no debounce required in v1).

## Edge cases

| Case | Behavior |
|---|---|
| `Prompts/` folder missing | `prompts/list` returns `[]`. No error. |
| File missing `mcp-tools-prompt` tag | Excluded from list silently. |
| No arg declarations in body | Valid prompt with `arguments: []`. |
| Arg provided but no matching `{{placeholder}}` | Ignored silently. |
| Arg declared but not provided in `prompts/get` | Placeholder left as-is in returned text. |
| File renamed (in Obsidian) | `listChanged` fires; client re-fetches list. |
| Duplicate name (two files differ only in extension) | Not possible: only `.md` files are scanned. |
| Templater not installed | No impact — Templater is not invoked. |

## Success criteria

1. `prompts/list` returns a non-empty list when `Prompts/` contains at least
   one `.md` file tagged `mcp-tools-prompt`.
2. `prompts/get("my-prompt", { topic: "Rust" })` returns a user message with
   `{{topic}}` substituted by `"Rust"`.
3. Adding a new file to `Prompts/` while the server is running triggers a
   `notifications/prompts/list_changed` notification within one Obsidian event
   cycle.
4. All existing 999 tests continue to pass.
5. `bun run check` (type check) passes with no new errors.
6. The feature degrades gracefully when `Prompts/` is absent — no crash, no
   uncaught error.
