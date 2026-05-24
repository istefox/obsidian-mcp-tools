# ADR-0003 — `execute_dataview_query` in-process tool

- **Status**: Proposed
- **Date**: 2026-05-24
- **Scope**: RFC #166 — 1 new in-process MCP tool. PR authored by an external contributor against the surface this ADR settles.

## Context

The current line's headline property is **LRA-optional**: of the 37 MCP tools, exactly **one** capability is coupled to the Local REST API (LRA) plugin — the Dataview DQL path inside `search_vault`. Everything else runs in-process against the Obsidian plugin API, so a user who only wants vault read/write/search/templates never has to install LRA.

`search_vault` (`tools/searchVault.ts`) routes both its DQL and JsonLogic branches through LRA's `/search/` endpoint via `requestUrl`, with the DQL branch sending `Content-Type: application/vnd.olrapi.dataview.dql+txt`. LRA in turn delegates DQL to Dataview and serialises the result back to HTTP text. So a user wanting DQL today pays for **two** plugins (LRA + Dataview) and gets a flattened text payload, even though Dataview is already loaded in-process and exposes a typed API directly: `app.plugins.plugins.dataview.api.query(query, originFile)`.

This is the single seam keeping the LRA-coupled count above zero for the common DQL use case. Removing it — by adding an in-process path that calls Dataview's API directly — is the same calculus that justified Module C (periodic notes, ADR-0002) and Module D (frontmatter properties, ADR-0001): a real capability broadening at zero net LRA cost, preserving the native typed shape instead of parsing HTTP text back into structure.

The decision to add the tool is **accepted** (RFC #166, owner accept comment). This ADR formalises the surface and settles the edges the RFC left open; it does not re-open the decision.

Constraints from `CLAUDE.md` / `.clinerules` that shape the surface:

- Tools register via `ToolRegistry` with an ArkType schema + `.describe()` on the top-level schema and every field; results are shaped `{ content: [{ type: "text", text }], isError?: boolean }`.
- Never touch the vault filesystem directly — go through the Obsidian / plugin APIs so the metadata cache, file locks, and other plugins' hooks stay coherent. Calling Dataview's own API (which reads from its own index) honours this.
- The feature-setup contract: a missing dependency must **not** throw — it degrades gracefully and surfaces an actionable error. The periodic-notes detector (`services/periodicNotesDetector.ts`) is the precedent for the plugin-detection seam: read plugin state **at call time**, branch on it, fall back cleanly.

Three sub-decisions are needed for a clean tool:

1. **Coexistence** — does this replace `search_vault`'s DQL branch, or land alongside it?
2. **Result shape** — what does success / failure look like at the MCP boundary, and which envelope convention does it follow (the codebase has two)?
3. **Plugin detection** — Dataview can be absent, present-but-not-ready, or ready. How are the three states distinguished and surfaced?

## Decision

### Tool surface — one new tool, alongside `search_vault`

Add `execute_dataview_query(query: string, sourcePath?: string)` as a **new in-process tool**. `search_vault` stays **exactly as-is** (JsonLogic + the LRA-coupled DQL path remain for backward compatibility — callers depending on its current response shape are not disturbed).

Backed by `app.plugins.plugins.dataview.api.query(query, sourcePath)`. In-process, no HTTP, no LRA. The `sourcePath?` argument is the origin file that establishes relative context for source resolution in the query (Dataview's API names this parameter `originFile`; the tool exposes it as `sourcePath` for caller clarity, matching the RFC's signature).

Naming `execute_dataview_query` (verb-led, not `search_*`) is deliberate: it matches the `execute_*` verb family (`execute_template`, `execute_obsidian_command`) and the prior 0.3.4 fork precedent. The distinct verb signals an action against the Dataview engine, not a vault text search — which keeps the model from conflating it with `search_vault` / `search_vault_simple` / `search_vault_smart`.

### Result shape — native typed result on success, `{ errorCode, … }` JSON on failure

On success the tool returns Dataview's **native typed result**, JSON-serialised into the standard MCP text envelope:

```jsonc
// type: "table"
{ "type": "table", "headers": [...], "values": [[...], ...] }
// type: "list"
{ "type": "list", "values": [...] }
// type: "task"
{ "type": "task", "values": [...] }
// type: "calendar"
{ "type": "calendar", "values": [...] }
```

wrapped as `{ content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }` — the same `JSON.stringify(value, null, 2)` serialisation the structured-read tools use (`getNoteProperty.ts`, `getRecentFiles.ts`, `getVaultFilePartial.ts`). The success path sets **no** `isError`.

> **Note on Dataview's raw shape.** Dataview's `query()` resolves to `Result<QueryResult, string>`, i.e. `{ successful, value, error }`, and the success `value` carries a few extra fields beyond the four named above (`idMeaning` on table, `primaryMeaning` on list, a `Grouping<SListItem>` for task, and `{date, link, value?}` entries for calendar). The tool unwraps the `Result` envelope (it is Dataview-internal, not part of our contract) and returns the inner typed `value`. Whether to pass the extra `idMeaning`/`primaryMeaning`/grouping fields through verbatim or trim them is an implementation detail left to the PR; the load-bearing contract is the `type` discriminator + `headers`/`values` per the table above. The PR must confirm the exact runtime shape against the installed Dataview version rather than trusting this doc.

On failure the tool returns a JSON error object carrying an `errorCode` discriminator, **and sets `isError: true`** — matching the `getNoteProperty` / `setNoteProperty` convention exactly:

```jsonc
{ "error": "<human-readable>", "errorCode": "<code>", "query": "<the query>" }
```

This is a deliberate convention choice, see the **open-item resolution** below.

### Plugin detection — three-state, at call time

Detection runs **at call time** (mirroring the periodic-notes detector, which reads plugin state per call and never caches), and is **three-state**, not two:

| State | Check | `errorCode` | `isError` | Hint to caller |
|---|---|---|---|---|
| **Absent** | `app.plugins.plugins["dataview"]` is `undefined` | `dataview_not_installed` | `true` | Install Dataview from the community plugins, enable it, retry. Permanent until the user acts. |
| **Present but not ready** | plugin object exists but `.api` is `undefined` (plugin loaded, index not built yet) | `dataview_not_ready` | `true` | **Transient.** The index is still building; Dataview fires `dataview:index-ready` when done. Retry shortly. **Distinct from not-installed** — the fix is to wait, not to install. |
| **Ready** | `.api` is present | run `api.query(query, sourcePath)` | — | — |

When the query runs and Dataview returns a `{ successful: false }` result (DQL parse error, unknown field, malformed `FROM`, etc.), map it to:

| Condition | `errorCode` | `isError` | Carries |
|---|---|---|---|
| `query()` resolves with `successful: false` | `dataview_query_failed` | `true` | Dataview's own `error` string verbatim, plus the `query` |

The `dataview_not_ready` / `dataview_not_installed` split is the key edge the RFC flagged and is the same graceful-degradation shape as ADR-0002's plugin-off fallback — just with the readiness sub-case made an explicit, distinct, retryable state rather than collapsed into "not installed".

### JSON-vs-Markdown output — deferred

Dataview also exposes `queryMarkdown()` (same signature, returns rendered Markdown). A `format: "json" | "markdown"` flag is **deferred**: the JSON typed shape is what an agent wants ~99% of the time (it can post-process structured rows; rendered Markdown is a presentation concern), and adding the flag now is speculative surface. Revisit on explicit demand. (See Alternative 3.)

### Tool count

37 → 38. **The LRA-coupled count stays at 1** — `search_vault`'s LRA DQL/JsonLogic path is untouched, so the headline LRA-optional property is unchanged in count but materially improved in practice: the common DQL workflow now has a zero-LRA path.

## Alternatives considered

1. **Replace `search_vault`'s DQL branch in-place** — route DQL in-process when Dataview is present, fall through to LRA otherwise. **Rejected**: couples two unrelated dependency paths (in-process Dataview vs. LRA HTTP) inside one handler, and risks behavioural drift for callers relying on LRA's current response shape (LRA returns flattened HTTP text; the in-process path returns the native typed structure — silently swapping them under one tool name breaks any agent that parses the old shape). A new tool keeps each path's contract stable and lets the model choose explicitly. Two tools, two clear contracts.

2. **Don't add the tool; compose `list_vault_files` + per-file reads** — let the agent emulate aggregation client-side. **Rejected**: defeats Dataview's entire purpose. TABLE / LIST / TASK queries are *aggregations and joins across many notes* (group, sort, filter on frontmatter + inline fields + tasks); reconstructing that from N per-file reads is O(vault) round-trips, loses Dataview's index, and the model would have to reimplement DQL semantics. Dataview already owns this; we call it.

3. **Add a JSON-vs-Markdown `format` flag now** (`format: "json" | "markdown"`, the latter via `queryMarkdown()`). **Deferred** (not rejected on merit): the JSON typed shape covers ~99% of agent use; Markdown rendering is a follow-up only if a concrete need surfaces. Adding it speculatively widens the surface and the `.describe()` docs for a path no current caller needs. The `queryMarkdown` API exists and the flag can be added backward-compatibly later (additive optional arg).

## Consequences

**Positive**:

- The common DQL workflow gains a **zero-LRA in-process path** — Dataview alone suffices; LRA is no longer required just to run a TABLE/LIST query. The LRA-optional pitch holds in practice, not just in tool count.
- Native typed result (`{type, headers, values}` etc.) is **strictly more useful to an agent** than LRA's flattened HTTP text — no re-parsing structure out of a serialised string; the discriminated `type` lets the model branch on table-vs-list-vs-task directly.
- The three-state detector gives the model an **actionable, distinguishable** failure for each cause: install (permanent action), wait-and-retry (transient), fix-the-query (caller error). A two-state detector would have conflated "index still warming up" with "not installed" and sent the agent down the wrong remediation.
- Trusting Dataview's own DQL parser (see open-item resolution) means **zero DQL-grammar surface to maintain** in this repo — Dataview's parse errors are surfaced verbatim, and they stay correct automatically as Dataview's grammar evolves.

**Negative**:

- Tool count grows 37 → 38. Within comfortable bounds for Claude Desktop / Cursor / Cline tool-list rendering, but non-zero. Bumped in the `CLAUDE.md` MCP-surface table in the implementing PR.
- **Two DQL paths now coexist** (`search_vault queryType:"dataview"` via LRA, and `execute_dataview_query` in-process). The model must pick. Mitigated by `.describe()`: `execute_dataview_query` is documented as the in-process, no-LRA, typed-result path (prefer it); `search_vault`'s DQL stays for LRA-chain backward compatibility. The verb-vs-search naming reinforces the distinction. This is an accepted cost of not breaking the existing `search_vault` contract (Alternative 1).
- **Large TABLE results are not truncated** (see open-item resolution): a `TABLE FROM ""` over a 10k-note vault can return a very large payload, which the model pays for in context tokens. No read tool in the current tree truncates by byte-size — they either cap by explicit `limit` (`get_recent_files` 1–100, `list_property_values` ≥500 + `truncated` flag) or do not bound at all (`search_vault`, `get_vault_file`). Mitigation is documented in `.describe()`, not enforced (see resolution).
- Dataview's API is a **runtime-only surface not in our `.d.ts`** — `app.plugins.plugins.dataview.api` is accessed through a cast (same pattern `CLAUDE.md` prescribes for runtime-only Obsidian APIs, e.g. `listTags.ts` `getTags`, `getRecentFiles.ts` `isUserIgnored`, and the `obsidian-daily-notes-interface` runtime-bag cast in `periodicNotesDetector.ts`). If Dataview renames `.api` or changes the `Result` shape, this tool breaks at runtime; the `dataview_not_ready` branch (`.api` undefined) absorbs the rename case as a (misleading-but-safe) "not ready" rather than a throw, which is the safe-fail direction.

**Neutral**:

- Coexists with `search_vault`: the latter remains the JsonLogic path and the LRA-coupled DQL path; the new tool is the in-process typed DQL path. Three coexistence pairs now follow this "new tool beside old, `.describe()` disambiguates" pattern (ADR-0001 `set_note_property` beside `patch_vault_file`; ADR-0002 periodic tools beside `execute_template`; this).
- Detection reads `app.plugins.plugins["dataview"]` — the **community-plugin** registry, parallel to ADR-0002's `app.plugins.plugins["periodic-notes"]`. (Dataview is a community plugin, not a core/internal one, so it is **not** under `app.internalPlugins`.)
- The `dataview:index-ready` event is named in the `dataview_not_ready` hint as the signal a caller can wait on; the tool itself does **not** subscribe to it or block — it fails fast with the retry hint and lets the caller (or the agent) retry. No long-lived listener, no readiness cache, consistent with the call-time-detection pattern.

## Open items resolved in this ADR

- **Does an `errorCode` failure set `isError: true`?** **Yes.** Verified against the tree: `getNoteProperty.ts` and `setNoteProperty.ts` both return `JSON.stringify({ error, errorCode, … }, null, 2)` in `text` **and** set `isError: true`. The tool follows this convention for all four error codes. *(Flagged inconsistency in the codebase — see Risk flags: `search_vault` uses a different failure convention. The new tool deliberately follows the `errorCode`-JSON property-tools convention, **not** the plain-text `search_vault` convention.)*

- **DQL validation.** **Trust Dataview's own DQL parser; do not reimplement a DQL validator.** ArkType validates the boundary shape only (`query: string>0`, `sourcePath?: string>0`). DQL grammar validity is delegated entirely to `api.query()`, and a `{ successful: false }` result surfaces Dataview's parse/eval error verbatim under `errorCode: "dataview_query_failed"`. Reasoning: a second DQL parser in this repo would (a) inevitably drift from Dataview's grammar as it evolves, (b) duplicate logic Dataview already owns, and (c) reject queries Dataview would accept (or vice-versa) — a worse contract than surfacing the engine's own error. Same principle as ADR-0002's "we do not second-guess the plugin's API" and `getVaultFilePartial`'s "reflect Obsidian's cache, never re-parse YAML independently" (#138).

- **Result size / truncation.** **No byte-size truncation; document the consideration, do not enforce it.** Consistent with how the tree handles big read payloads: no existing read tool truncates by size — `search_vault` and `get_vault_file` return the full payload unbounded, while `get_recent_files` / `list_property_values` bound by an explicit caller-supplied `limit` (with `list_property_values` reporting `truncated: true` when it caps). DQL has no natural row-count knob to inject without altering the query, and DQL itself supports `LIMIT` in-language — so the right place to bound a large result is the query the caller writes (`TABLE … LIMIT 100`), surfaced via `.describe()`, rather than a tool-level row cap that would silently drop rows and contradict the "native typed result" contract. The PR documents the large-result caveat in the tool's `.describe()` and recommends in-DQL `LIMIT`. *(A future `limit?` arg or a `truncated` wrapper could be added backward-compatibly if real usage shows it is needed — deferred, not designed in now.)*

## References

- RFC: GitHub issue #166 (`execute_dataview_query`) — owner accept comment locks name, signature, JSON-default, three-state detection, count 37 → 38 / LRA-coupled stays 1.
- ADR-0001 — Atomic frontmatter property tools (the `errorCode`-JSON + `isError: true` failure convention this tool follows).
- ADR-0002 — Periodic / daily notes tools (the call-time plugin-detection + graceful-fallback pattern this tool mirrors; `app.plugins.plugins[...]` community-plugin check).
- Repo pattern: `packages/obsidian-plugin/src/features/mcp-tools/tools/getNoteProperty.ts`, `setNoteProperty.ts` (error-envelope shape); `getRecentFiles.ts`, `getVaultFilePartial.ts` (`JSON.stringify(value, null, 2)` structured-result serialisation, runtime-only-API cast); `searchVault.ts` (the coexisting LRA DQL path — left unchanged).
- Detector seam: `packages/obsidian-plugin/src/features/mcp-tools/services/periodicNotesDetector.ts` (call-time detection + runtime-API cast precedent).
- Registration: `packages/obsidian-plugin/src/features/mcp-tools/index.ts` (the new tool registers in the Search group beside `search_vault`).
- Dataview API: `app.plugins.plugins.dataview.api.query(source, originFile?, settings?) → Promise<Result<QueryResult, string>>` and `queryMarkdown(...)`; success `value` is `{type:"table",headers,values,idMeaning}` | `{type:"list",values,primaryMeaning}` | `{type:"task",values}` | `{type:"calendar",values}`. Source: [`obsidian-dataview/src/api/plugin-api.ts`](https://github.com/blacksmithgu/obsidian-dataview/blob/master/src/api/plugin-api.ts), [Dataview codeblock reference](https://blacksmithgu.github.io/obsidian-dataview/api/code-reference/). The PR verifies the exact `value` shape against the installed Dataview version.
- `CLAUDE.md` — Tool registration pattern; runtime-only-API cast guidance; MCP-surface tool table (count bump lands in the implementing PR).
