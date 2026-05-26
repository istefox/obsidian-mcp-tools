# ADR-0004 — Vault Intelligence Tools (Module E)

- **Status**: Accepted
- **Date**: 2026-05-26
- **Target release**: 0.8.0
- **Scope**: 5 new MCP tools: `find_broken_links`, `find_orphaned_notes`,
  `search_and_replace`, `get_note_outline`, `list_bookmarks`. Tool count 38 → 43.

---

## Context

v0.7.0 ships 38 MCP tools covering vault CRUD, metadata, search, periodic
notes, web fetch, and commands. The graph-maintenance and navigation use cases
remain entirely in the client LLM's hands: an agent wanting to audit broken
links must call `get_outgoing_links` N times (one per file), assemble the
unresolved set client-side, and repeat for orphans. That is O(vault) round-trips
for housekeeping that the server can execute in a single metadata-cache pass.

Module E adds five tools that close these gaps:

1. **`find_broken_links`** — vault-wide broken-link audit via metadata cache.
2. **`find_orphaned_notes`** — graph orphan detection via `resolvedLinks`.
3. **`search_and_replace`** — regex bulk-edit with mandatory dry-run gate.
4. **`get_note_outline`** — heading TOC for a single note (anchor-ready).
5. **`list_bookmarks`** — exposes Obsidian's native bookmark plugin hierarchy.

All five follow the established pattern: ArkType schema + async handler +
`*Context` type, registered via `ToolRegistry`, no direct `fs` access. No new
external dependencies are introduced.

Three design decisions have non-trivial alternatives:

1. **Search-and-replace scope of writes**: what is the correct safe default and
   how is the dry-run gate enforced?
2. **Orphan definition**: should links from excluded folders count toward a
   note's "referenced" status?
3. **Bookmarks access**: `internalPlugins` vs. `plugins` registry for the
   Bookmarks core plugin.

---

## Decision

### Architecture: same module layout as A–D

Ten files total under
`packages/obsidian-plugin/src/features/mcp-tools/tools/`:

```
findBrokenLinks.ts + findBrokenLinks.test.ts
findOrphanedNotes.ts + findOrphanedNotes.test.ts
searchAndReplace.ts + searchAndReplace.test.ts
getNoteOutline.ts + getNoteOutline.test.ts
listBookmarks.ts + listBookmarks.test.ts
```

One edit to `index.ts`: 5 imports + 5 `registry.register(...)` calls, grouped
under a new `// Vault intelligence` comment block. No new feature folder; these
tools are metadata/search in nature and fit the existing `mcp-tools` feature.

### Decision 1 — search_and_replace write safety: `dry_run` default `"true"`, no bypass

`dry_run` defaults to `"true"`. The `ToolRegistry` coerces the incoming string
to the real value; the schema declares it as `'"true" | "false"'` (same belt-
and-suspenders pattern as `execute_template.createFile`). The handler reads the
post-coercion value to branch.

When `dry_run` resolves to `true`, `vault.modify` is never called — the preview
is built from an in-memory apply of the regex on the already-read content,
discarded after the response is formed. This means there is no window where a
file is partially written.

The regex is validated first with `try { new RegExp(pattern, flags) } catch`.
An invalid regex returns `isError: true` immediately, before any file is read.
The `"g"` flag is always injected into `flags` if absent (JavaScript's
`String.prototype.replace` with a non-global regex only replaces the first
match — silently, which is a footgun). The injected flag is surfaced in the
response as `flags_used`.

### Decision 2 — orphan definition: links from excluded folders DO count

A note is an orphan only if **no file in the entire vault** has a resolved link
pointing to it — regardless of whether the linking file is in an excluded
folder. The `exclude_folders` parameter controls which notes *appear in the
orphan output*, not which notes *count as references*.

Rationale: a "Templates/onboarding.md" linking to "daily-log.md" is a real
link. Excluding it from the count would cause "daily-log.md" to appear as an
orphan, which is wrong. The SPEC makes this explicit: "I link provenienti da
cartelle escluse contano comunque come link entranti".

### Decision 3 — list_bookmarks: `internalPlugins` path, not `plugins`

Obsidian's Bookmarks feature is a **core plugin** (ships with Obsidian,
enabled/disabled under `Settings → Core plugins`). Core plugins live under
`app.internalPlugins.plugins`, not `app.plugins.plugins` (community plugins).
The community plugin registry would return `undefined` for a core plugin id,
silently degrading to `{ enabled: false }` — incorrect and confusing.

Access pattern (matches SPEC §Implementation):

```typescript
const bk = (app.internalPlugins as unknown as {
  plugins: { bookmarks?: { enabled: boolean; instance?: { items: unknown[] } } }
}).plugins.bookmarks;
```

If `bk` is absent or `bk.enabled` is false → `{ enabled: false, total_items: 0, items: [] }`.

The mock for tests: extend `mockApp()` via the test `internalPlugins` slot
(added as part of Task 5's test infrastructure, similar to how `plugins.plugins`
was extended for ADR-0003).

### Decision 4 — anchor slug algorithm: match Obsidian's own, accept divergence on special chars

Obsidian's heading-to-anchor mapping is not formally documented, and the
behavior differs slightly from GitHub Markdown for non-ASCII or punctuation
heavy headings. The SPEC supplies the implementation:

```typescript
text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-")
```

This is a best-effort approximation. Tests assert the algorithm's output for
the cases we control; they do not assert parity with Obsidian's internal
renderer (which is only exercised at runtime). The anchor is advisory for the
model — it allows constructing `[[note#heading]]` links. If Obsidian's internal
algorithm ever changes, the tool is updated, not the test fixture.

---

## Alternatives considered

### Alt A — search_and_replace: dry_run defaults to `"false"` (immediate write)

Rationale for rejection: `search_and_replace` is the only tool in the suite
with irreversible write-side effects at vault scale. A default of `"false"` with
a large scope and a greedy pattern can silently corrupt hundreds of files if the
LLM misconstructs the call. The safe-by-default convention has no meaningful
friction for the model (one extra parameter per intentional write) and aligns
with the SPEC requirement ("dry_run obbligatorio"). Rejected: asymmetric risk.

### Alt B — orphaned notes: links from excluded folders do NOT count

This would let users define "source zones" (e.g. templates) that don't
contribute to the graph. The appeal is conceptual cleanness: "I don't care
about links from my template folder." Rejected because: (a) it contradicts the
SPEC explicitly, (b) it makes the orphan definition depend on which exclusion
list the caller uses — the same note could be orphaned or not depending on the
exclude_folders parameter, making results non-reproducible across two calls with
different exclusions. The SPEC's definition is simpler and deterministic.

### Alt C — list_bookmarks: poll `app.plugins.plugins["bookmarks"]` (community path)

This path is used by Dataview (ADR-0003) and the periodic-notes detector
(ADR-0002). Using it for Bookmarks would keep the mock infrastructure uniform.
Rejected: Bookmarks is a core plugin — it is not in the community registry.
Using the community path would silently return `undefined` for a core plugin
and misrepresent the "disabled" state. The `internalPlugins` path is the
correct seam; the mock overhead is small (one getter added to `mockApp()`).

### Alt D — find_broken_links: use `metadataCache.unresolvedLinks` map directly

`unresolvedLinks` is a `Record<source, Record<linkpath, count>>` already
maintained by Obsidian. It would avoid iterating the full file cache. Rejected
because: (a) the SPEC explicitly notes that `unresolvedLinks` does not carry
position information (line number, link type, original syntax) — which the tool
must expose; (b) `unresolvedLinks` may include transient entries for files not
yet indexed after a rename; (c) the per-file cache iteration is the same cost
paid by `get_outgoing_links` for a single file — at vault scale it is still
metadata-only (no I/O). Position context is worth the traversal cost.

---

## Consequences

**Positive**

- Vault maintenance tasks (broken link audit, orphan detection, bulk rename
  preview) that previously required N sequential tool calls are now single
  calls. Agent efficiency gain is O(vault size).
- `search_and_replace` dry-run default means the agent can show the user a
  preview before committing — no silent mass-edit risk.
- `get_note_outline` enables deep navigation of long notes without reading
  the whole file body.
- `list_bookmarks` exposes the user's own curated entry points to the vault —
  high signal for a cold-start agent session.

**Negative**

- Tool count 38 → 43. Still within Claude Desktop tool-list bounds, but
  non-trivial growth. `CLAUDE.md` MCP-surface table must be updated in the
  implementing PR.
- `search_and_replace` with `dry_run: "false"` is the first tool in the suite
  that writes to arbitrary files at scale. Callers must understand the
  `dry_run` flag contract; the `.describe()` must be unambiguous.
- `list_bookmarks` accesses `internalPlugins` via an `unknown` cast — same
  runtime-API pattern as `listTags`/`getRecentFiles`, but the property path
  is deeper. If Obsidian changes the Bookmarks plugin's internal key or
  structure, the tool degrades to `{ enabled: false }`, which is safe but
  silent (a `logger.warn` on the unrecognised shape mitigates this).

**Neutral**

- `get_note_outline` coexists with `get_vault_file_partial mode:"headings"`.
  The distinction: `get_vault_file_partial` returns the raw heading text with
  surrounding context; `get_note_outline` returns structured TOC data (level,
  line number, anchor slug). The `.describe()` documents this.
- The mock infrastructure (`test-setup.ts`) requires one addition: an
  `internalPlugins` slot on `mockApp()` to support `list_bookmarks` tests.
  This is additive and backward-compatible; no existing test is affected.
- Five new test files. Minimum 6 tests each = 30 tests. The local test command
  excludes the plugin package due to port conflict with the live MCP server;
  these tests run on CI via `bun test` in `packages/obsidian-plugin`.

---

## References

- SPEC.md (`/Users/stefanoferri/Developer/Obsidian_MCP/SPEC.md`) — Modulo E.
- ADR-0001 — `errorCode` + `isError: true` failure convention.
- ADR-0002 — call-time plugin detection pattern.
- ADR-0003 — `internalPlugins` vs `plugins` distinction; runtime-API cast
  pattern.
- `packages/obsidian-plugin/src/features/mcp-tools/tools/getOutgoingLinks.ts`
  — `getFirstLinkpathDest` resolution pattern reused in `find_broken_links`.
- `packages/obsidian-plugin/src/features/mcp-tools/tools/getBacklinks.ts`
  — `resolvedLinks` reverse-index pattern reused in `find_orphaned_notes`.
- `packages/obsidian-plugin/src/features/mcp-tools/tools/getRecentFiles.ts`
  — vault-wide scan + `isUserIgnored` exclusion pattern.
- `packages/obsidian-plugin/src/test-setup.ts` — mock infrastructure to extend.
- `packages/obsidian-plugin/src/features/mcp-tools/index.ts` — registration
  site (38 tools currently, will become 43).
