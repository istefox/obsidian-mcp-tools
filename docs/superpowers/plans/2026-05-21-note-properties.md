# Note Properties (Module D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 atomic MCP tools for single-key Obsidian frontmatter ("note property") operations: `get_note_property`, `set_note_property`, `delete_note_property`, `list_property_values`.

**Architecture:** Each tool is a self-contained file under `packages/obsidian-plugin/src/features/mcp-tools/tools/`, following the established repo pattern (ArkType `*Schema` + async `*Handler` + a `*Context` type, unit-tested next to the source). Reads use `app.metadataCache` (no file I/O); writes use `app.fileManager.processFrontMatter` (atomic, metadata-cache-safe). Registration is one edit to `mcp-tools/index.ts`. Tools are autonomous — no shared helper, matching how `getVaultFile` / `getFilesByTag` already inline their own file lookup.

**Tech Stack:** TypeScript 5 strict (`verbatimModuleSyntax`), ArkType for boundary validation, `bun:test` (native), Obsidian API (`app.vault`, `app.metadataCache`, `app.fileManager`). Source spec: `docs/design/2026-05-20-frontmatter-properties-and-periodic-notes.md` (Module D); ADR: `docs/architecture/ADR-0001-atomic-frontmatter-property-tools.md`.

---

## Pre-flight

- [ ] **Step 0: Branch**

```bash
git checkout main && git pull --ff-only
git checkout -b feat/note-properties
```

## File Structure

- Create: `packages/obsidian-plugin/src/features/mcp-tools/tools/getNoteProperty.ts` — read one FM key.
- Create: `packages/obsidian-plugin/src/features/mcp-tools/tools/getNoteProperty.test.ts`
- Create: `packages/obsidian-plugin/src/features/mcp-tools/tools/setNoteProperty.ts` — write one FM key (auto-init FM, `null` → delete redirect, key validation).
- Create: `packages/obsidian-plugin/src/features/mcp-tools/tools/setNoteProperty.test.ts`
- Create: `packages/obsidian-plugin/src/features/mcp-tools/tools/deleteNoteProperty.ts` — idempotent delete.
- Create: `packages/obsidian-plugin/src/features/mcp-tools/tools/deleteNoteProperty.test.ts`
- Create: `packages/obsidian-plugin/src/features/mcp-tools/tools/listPropertyValues.ts` — vault-wide distinct value enumeration.
- Create: `packages/obsidian-plugin/src/features/mcp-tools/tools/listPropertyValues.test.ts`
- Modify: `packages/obsidian-plugin/src/features/mcp-tools/index.ts` — import + register the 4 tools.
- Modify: `CLAUDE.md` — tool count 30 → 34 + 4 rows in the Vault file management table.
- Modify: `CHANGELOG.md` — `[Unreleased]` `### Added`.

### Shared conventions (apply in every tool)

- Handler return shape: `{ content: Array<{ type: "text"; text: string }>; isError?: boolean }` — exactly as `getFilesByTag`.
- File lookup (read or write) — **null-check + cast, NOT `instanceof TFile`**. The test mock's `getAbstractFileByPath` returns a plain `MockTFile` object (not an instance of the synthetic `TFile` class), so `instanceof TFile` is always false under test. The repo pattern (`getVaultFile.ts:111-121`) is:
  ```ts
  const abstract = ctx.app.vault.getAbstractFileByPath(ctx.arguments.path);
  if (!abstract) {
    return { content: [{ type: "text", text: JSON.stringify({ error: "File not found", errorCode: "file_not_found", path: ctx.arguments.path }, null, 2) }], isError: true };
  }
  const file = abstract as TFile;
  ```
  `TFile` is a **type-only** import: `import type { App, TFile } from "obsidian"` (no `instanceof`, so no value import needed).
- Success payloads are `JSON.stringify(obj, null, 2)` text (repo convention).
- Unit tests bypass `ToolRegistry`, so they call the handler with **native-typed** `value` (boolean as real `boolean`, etc.). The boolean-as-string coercion is `ToolRegistry`'s job and is tested there, not here (ADR-0001 §Decision; CLAUDE.md Gotcha).

---

### Task 1: `get_note_property`

**Files:**
- Create: `packages/obsidian-plugin/src/features/mcp-tools/tools/getNoteProperty.ts`
- Test: `packages/obsidian-plugin/src/features/mcp-tools/tools/getNoteProperty.test.ts`

Reads via `metadataCache` (no I/O). Missing file → `file_not_found` error. Missing frontmatter or missing key → `value: null` (not an error). Native type preserved.

- [ ] **Step 1: Write the failing test**

```ts
// getNoteProperty.test.ts
import { describe, expect, test, beforeEach } from "bun:test";
import { getNotePropertyHandler, getNotePropertySchema } from "./getNoteProperty";
import { mockApp, resetMockVault, setMockFile, setMockMetadata } from "$/test-setup";

beforeEach(() => resetMockVault());

describe("get_note_property tool", () => {
  test("schema declares the tool name", () => {
    expect(getNotePropertySchema.get("name")?.toString()).toContain("get_note_property");
  });

  test("returns the native-typed value for an existing key", async () => {
    setMockFile("n.md", "");
    setMockMetadata("n.md", { frontmatter: { priority: 5, status: "done" } });
    const r = await getNotePropertyHandler({ arguments: { path: "n.md", key: "priority" }, app: mockApp() });
    expect(JSON.parse(r.content[0].text as string)).toEqual({ path: "n.md", key: "priority", value: 5 });
  });

  test("returns value:null when the key is absent", async () => {
    setMockFile("n.md", "");
    setMockMetadata("n.md", { frontmatter: { status: "done" } });
    const r = await getNotePropertyHandler({ arguments: { path: "n.md", key: "missing" }, app: mockApp() });
    expect(JSON.parse(r.content[0].text as string)).toEqual({ path: "n.md", key: "missing", value: null });
  });

  test("returns value:null when the note has no frontmatter", async () => {
    setMockFile("n.md", "body only");
    const r = await getNotePropertyHandler({ arguments: { path: "n.md", key: "any" }, app: mockApp() });
    expect(JSON.parse(r.content[0].text as string).value).toBeNull();
  });

  test("errors with file_not_found for a missing path", async () => {
    const r = await getNotePropertyHandler({ arguments: { path: "nope.md", key: "k" }, app: mockApp() });
    expect(r.isError).toBe(true);
    expect(JSON.parse(r.content[0].text as string).errorCode).toBe("file_not_found");
  });

  test("preserves list values verbatim", async () => {
    setMockFile("n.md", "");
    setMockMetadata("n.md", { frontmatter: { tags: ["a", "b"] } });
    const r = await getNotePropertyHandler({ arguments: { path: "n.md", key: "tags" }, app: mockApp() });
    expect(JSON.parse(r.content[0].text as string).value).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/obsidian-plugin && bun test src/features/mcp-tools/tools/getNoteProperty.test.ts`
Expected: FAIL — `Cannot find module "./getNoteProperty"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// getNoteProperty.ts
import { type } from "arktype";
import { TFile } from "obsidian";
import type { App } from "obsidian";

export const getNotePropertySchema = type({
  name: '"get_note_property"',
  arguments: {
    path: type("string>0").describe("Vault-relative path to the note (e.g. `Projects/Roadmap.md`)."),
    key: type("string>0").describe("Top-level frontmatter (YAML) key to read."),
  },
}).describe(
  "Reads a single frontmatter (note property) value from a vault note, preserving its native YAML type (string, number, boolean, or list). Returns `value: null` when the key is absent or the note has no frontmatter — that is not an error. Reads from Obsidian's metadata cache (no file I/O). Always read-only. To read the whole frontmatter block, use `get_vault_file_partial` with `mode:\"frontmatter\"`.",
);

export type GetNotePropertyContext = {
  arguments: { path: string; key: string };
  app: App;
};

export async function getNotePropertyHandler(ctx: GetNotePropertyContext): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const file = ctx.app.vault.getAbstractFileByPath(ctx.arguments.path);
  if (!(file instanceof TFile)) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: "File not found", errorCode: "file_not_found", path: ctx.arguments.path }, null, 2) }],
      isError: true,
    };
  }
  const fm = ctx.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
  const value = fm && Object.prototype.hasOwnProperty.call(fm, ctx.arguments.key) ? fm[ctx.arguments.key] : null;
  return {
    content: [{ type: "text", text: JSON.stringify({ path: ctx.arguments.path, key: ctx.arguments.key, value: value ?? null }, null, 2) }],
  };
}
```

> Note (design): a *malformed* frontmatter block is indistinguishable from an *absent* one through `metadataCache` (both surface as `frontmatter: undefined`), so this tool returns `value: null` for both. The spec's "malformed → error" diagnosis is delivered by `get_vault_file_partial mode:"frontmatter"`, which does the raw-read needed to tell them apart. Keeping `get_note_property` on the no-I/O cache path is deliberate (ADR-0001).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/obsidian-plugin && bun test src/features/mcp-tools/tools/getNoteProperty.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/obsidian-plugin/src/features/mcp-tools/tools/getNoteProperty.ts packages/obsidian-plugin/src/features/mcp-tools/tools/getNoteProperty.test.ts
git commit -m "feat(note-properties): add get_note_property tool"
```

---

### Task 2: `set_note_property`

**Files:**
- Create: `packages/obsidian-plugin/src/features/mcp-tools/tools/setNoteProperty.ts`
- Test: `packages/obsidian-plugin/src/features/mcp-tools/tools/setNoteProperty.test.ts`

Writes via `processFrontMatter` (atomic). `value: null` → behaves as delete. Auto-inits the FM block if absent (Obsidian's `processFrontMatter` does this — the mock seeds `{}` then assigns). YAML-illegal key (`:`, newline, leading `#`) → `invalid_key` error before any write. Missing file → `file_not_found`.

- [ ] **Step 1: Write the failing test**

```ts
// setNoteProperty.test.ts
import { describe, expect, test, beforeEach } from "bun:test";
import { setNotePropertyHandler, setNotePropertySchema } from "./setNoteProperty";
import { mockApp, resetMockVault, setMockFile, setMockMetadata } from "$/test-setup";

beforeEach(() => resetMockVault());

function readFm(path: string): Record<string, unknown> | undefined {
  const app = mockApp();
  const file = app.vault.getAbstractFileByPath(path);
  return app.metadataCache.getFileCache(file as never)?.frontmatter as Record<string, unknown> | undefined;
}

describe("set_note_property tool", () => {
  test("schema declares the tool name", () => {
    expect(setNotePropertySchema.get("name")?.toString()).toContain("set_note_property");
  });

  test("sets a scalar value, preserving native type", async () => {
    setMockFile("n.md", "");
    setMockMetadata("n.md", { frontmatter: {} });
    const r = await setNotePropertyHandler({ arguments: { path: "n.md", key: "priority", value: 5 }, app: mockApp() });
    expect(r.isError).toBeUndefined();
    expect(readFm("n.md")?.priority).toBe(5);
  });

  test("overwrites an existing key", async () => {
    setMockFile("n.md", "");
    setMockMetadata("n.md", { frontmatter: { status: "todo" } });
    await setNotePropertyHandler({ arguments: { path: "n.md", key: "status", value: "done" }, app: mockApp() });
    expect(readFm("n.md")?.status).toBe("done");
  });

  test("sets a boolean (native type, not string)", async () => {
    setMockFile("n.md", "");
    setMockMetadata("n.md", { frontmatter: {} });
    await setNotePropertyHandler({ arguments: { path: "n.md", key: "done", value: true }, app: mockApp() });
    expect(readFm("n.md")?.done).toBe(true);
  });

  test("sets a list value", async () => {
    setMockFile("n.md", "");
    setMockMetadata("n.md", { frontmatter: {} });
    await setNotePropertyHandler({ arguments: { path: "n.md", key: "tags", value: ["x", "y"] }, app: mockApp() });
    expect(readFm("n.md")?.tags).toEqual(["x", "y"]);
  });

  test("auto-initialises a missing frontmatter block", async () => {
    setMockFile("n.md", "just a body, no frontmatter");
    const r = await setNotePropertyHandler({ arguments: { path: "n.md", key: "k", value: "v" }, app: mockApp() });
    expect(r.isError).toBeUndefined();
    expect(readFm("n.md")?.k).toBe("v");
  });

  test("value:null removes the key (delete redirect)", async () => {
    setMockFile("n.md", "");
    setMockMetadata("n.md", { frontmatter: { gone: "x", keep: "y" } });
    await setNotePropertyHandler({ arguments: { path: "n.md", key: "gone", value: null }, app: mockApp() });
    const fm = readFm("n.md");
    expect(fm && Object.prototype.hasOwnProperty.call(fm, "gone")).toBe(false);
    expect(fm?.keep).toBe("y");
  });

  test("rejects a YAML-illegal key with invalid_key", async () => {
    setMockFile("n.md", "");
    setMockMetadata("n.md", { frontmatter: {} });
    const r = await setNotePropertyHandler({ arguments: { path: "n.md", key: "bad: key", value: "v" }, app: mockApp() });
    expect(r.isError).toBe(true);
    expect(JSON.parse(r.content[0].text as string).errorCode).toBe("invalid_key");
    // no write happened
    expect(readFm("n.md") ?? {}).toEqual({});
  });

  test("errors with file_not_found for a missing path", async () => {
    const r = await setNotePropertyHandler({ arguments: { path: "nope.md", key: "k", value: "v" }, app: mockApp() });
    expect(r.isError).toBe(true);
    expect(JSON.parse(r.content[0].text as string).errorCode).toBe("file_not_found");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/obsidian-plugin && bun test src/features/mcp-tools/tools/setNoteProperty.test.ts`
Expected: FAIL — `Cannot find module "./setNoteProperty"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// setNoteProperty.ts
import { type } from "arktype";
import { TFile } from "obsidian";
import type { App } from "obsidian";

export const setNotePropertySchema = type({
  name: '"set_note_property"',
  arguments: {
    path: type("string>0").describe("Vault-relative path to the note."),
    key: type("string>0").describe("Top-level frontmatter (YAML) key to set. Must not contain `:`, a newline, or a leading `#`."),
    value: type("string | number | boolean | string[] | number[] | null").describe(
      "Value to set. Native JSON types map to YAML: string, number, boolean, or a homogeneous list of strings/numbers. Dates are passed as ISO 8601 strings. Passing `null` removes the key (same as `delete_note_property`). Mixed-type lists are not supported — use `patch_vault_file` for those.",
    ),
  },
}).describe(
  "Sets a single frontmatter (note property) key on a vault note via Obsidian's atomic `processFrontMatter` API (no read-modify-write race). Creates the frontmatter block if the note has none. Passing `value: null` deletes the key. Coexists with `patch_vault_file targetType:\"frontmatter\"`, which replaces the entire block; this tool is for single-key edits.",
);

export type SetNotePropertyContext = {
  arguments: { path: string; key: string; value: string | number | boolean | string[] | number[] | null };
  app: App;
};

// YAML-illegal in a plain top-level key: a colon, any newline, or a leading `#` (comment marker).
function isInvalidKey(key: string): boolean {
  return /[:\n\r]/.test(key) || key.trimStart().startsWith("#");
}

export async function setNotePropertyHandler(ctx: SetNotePropertyContext): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const { path, key, value } = ctx.arguments;

  if (isInvalidKey(key)) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: "Invalid frontmatter key", errorCode: "invalid_key", key }, null, 2) }],
      isError: true,
    };
  }

  const file = ctx.app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: "File not found", errorCode: "file_not_found", path }, null, 2) }],
      isError: true,
    };
  }

  await ctx.app.fileManager.processFrontMatter(file, (fm) => {
    if (value === null) {
      delete fm[key];
    } else {
      fm[key] = value;
    }
  });

  const action = value === null ? "deleted" : "set";
  return {
    content: [{ type: "text", text: JSON.stringify({ path, key, action }, null, 2) }],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/obsidian-plugin && bun test src/features/mcp-tools/tools/setNoteProperty.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/obsidian-plugin/src/features/mcp-tools/tools/setNoteProperty.ts packages/obsidian-plugin/src/features/mcp-tools/tools/setNoteProperty.test.ts
git commit -m "feat(note-properties): add set_note_property tool (auto-init FM, null=delete, key validation)"
```

---

### Task 3: `delete_note_property`

**Files:**
- Create: `packages/obsidian-plugin/src/features/mcp-tools/tools/deleteNoteProperty.ts`
- Test: `packages/obsidian-plugin/src/features/mcp-tools/tools/deleteNoteProperty.test.ts`

Idempotent: deleting an absent key (or a note with no frontmatter) is a no-op success. Missing file → `file_not_found`.

- [ ] **Step 1: Write the failing test**

```ts
// deleteNoteProperty.test.ts
import { describe, expect, test, beforeEach } from "bun:test";
import { deleteNotePropertyHandler, deleteNotePropertySchema } from "./deleteNoteProperty";
import { mockApp, resetMockVault, setMockFile, setMockMetadata } from "$/test-setup";

beforeEach(() => resetMockVault());

function readFm(path: string): Record<string, unknown> | undefined {
  const app = mockApp();
  const file = app.vault.getAbstractFileByPath(path);
  return app.metadataCache.getFileCache(file as never)?.frontmatter as Record<string, unknown> | undefined;
}

describe("delete_note_property tool", () => {
  test("schema declares the tool name", () => {
    expect(deleteNotePropertySchema.get("name")?.toString()).toContain("delete_note_property");
  });

  test("removes an existing key, leaving the rest", async () => {
    setMockFile("n.md", "");
    setMockMetadata("n.md", { frontmatter: { gone: 1, keep: 2 } });
    const r = await deleteNotePropertyHandler({ arguments: { path: "n.md", key: "gone" }, app: mockApp() });
    expect(r.isError).toBeUndefined();
    const fm = readFm("n.md");
    expect(fm && Object.prototype.hasOwnProperty.call(fm, "gone")).toBe(false);
    expect(fm?.keep).toBe(2);
  });

  test("is idempotent for an absent key (no-op success)", async () => {
    setMockFile("n.md", "");
    setMockMetadata("n.md", { frontmatter: { keep: 2 } });
    const r = await deleteNotePropertyHandler({ arguments: { path: "n.md", key: "missing" }, app: mockApp() });
    expect(r.isError).toBeUndefined();
    expect(readFm("n.md")?.keep).toBe(2);
  });

  test("is idempotent for a note with no frontmatter", async () => {
    setMockFile("n.md", "body only");
    const r = await deleteNotePropertyHandler({ arguments: { path: "n.md", key: "any" }, app: mockApp() });
    expect(r.isError).toBeUndefined();
  });

  test("errors with file_not_found for a missing path", async () => {
    const r = await deleteNotePropertyHandler({ arguments: { path: "nope.md", key: "k" }, app: mockApp() });
    expect(r.isError).toBe(true);
    expect(JSON.parse(r.content[0].text as string).errorCode).toBe("file_not_found");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/obsidian-plugin && bun test src/features/mcp-tools/tools/deleteNoteProperty.test.ts`
Expected: FAIL — `Cannot find module "./deleteNoteProperty"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// deleteNoteProperty.ts
import { type } from "arktype";
import { TFile } from "obsidian";
import type { App } from "obsidian";

export const deleteNotePropertySchema = type({
  name: '"delete_note_property"',
  arguments: {
    path: type("string>0").describe("Vault-relative path to the note."),
    key: type("string>0").describe("Top-level frontmatter (YAML) key to remove."),
  },
}).describe(
  "Removes a single frontmatter (note property) key from a vault note via Obsidian's atomic `processFrontMatter` API. Idempotent: deleting a key that is absent (or a note with no frontmatter) succeeds as a no-op. To clear a key you can also call `set_note_property` with `value: null`.",
);

export type DeleteNotePropertyContext = {
  arguments: { path: string; key: string };
  app: App;
};

export async function deleteNotePropertyHandler(ctx: DeleteNotePropertyContext): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const { path, key } = ctx.arguments;
  const file = ctx.app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: "File not found", errorCode: "file_not_found", path }, null, 2) }],
      isError: true,
    };
  }

  await ctx.app.fileManager.processFrontMatter(file, (fm) => {
    delete fm[key];
  });

  return {
    content: [{ type: "text", text: JSON.stringify({ path, key, action: "deleted" }, null, 2) }],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/obsidian-plugin && bun test src/features/mcp-tools/tools/deleteNoteProperty.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/obsidian-plugin/src/features/mcp-tools/tools/deleteNoteProperty.ts packages/obsidian-plugin/src/features/mcp-tools/tools/deleteNoteProperty.test.ts
git commit -m "feat(note-properties): add delete_note_property tool (idempotent)"
```

---

### Task 4: `list_property_values`

**Files:**
- Create: `packages/obsidian-plugin/src/features/mcp-tools/tools/listPropertyValues.ts`
- Test: `packages/obsidian-plugin/src/features/mcp-tools/tools/listPropertyValues.test.ts`

Iterates `app.vault.getMarkdownFiles()` + `metadataCache.getFileCache(file)?.frontmatter[key]` (no I/O). Counts distinct values, preserving native type. Optional `folder` prefix filter (slash-normalised, like `list_vault_files`). `limit` (default 500) caps the returned distinct values to the top-N by count, descending; `truncated` + `totalDistinct` report when the underlying set is larger. List-valued frontmatter (`tags: [a,b]`) contributes each element as a value occurrence.

- [ ] **Step 1: Write the failing test**

```ts
// listPropertyValues.test.ts
import { describe, expect, test, beforeEach } from "bun:test";
import { listPropertyValuesHandler, listPropertyValuesSchema } from "./listPropertyValues";
import { mockApp, resetMockVault, setMockFile, setMockMetadata } from "$/test-setup";

beforeEach(() => resetMockVault());

function seed(path: string, fm: Record<string, unknown>): void {
  setMockFile(path, "");
  setMockMetadata(path, { frontmatter: fm });
}

describe("list_property_values tool", () => {
  test("schema declares the tool name", () => {
    expect(listPropertyValuesSchema.get("name")?.toString()).toContain("list_property_values");
  });

  test("counts distinct values descending with native types preserved", async () => {
    seed("a.md", { status: "active" });
    seed("b.md", { status: "active" });
    seed("c.md", { status: "done" });
    seed("d.md", { priority: 5 });
    const r = await listPropertyValuesHandler({ arguments: { key: "status" }, app: mockApp() });
    const data = JSON.parse(r.content[0].text as string);
    expect(data.totalDistinct).toBe(2);
    expect(data.truncated).toBe(false);
    expect(data.values).toEqual([
      { value: "active", count: 2 },
      { value: "done", count: 1 },
    ]);
  });

  test("preserves number vs string as distinct values", async () => {
    seed("a.md", { p: 5 });
    seed("b.md", { p: "5" });
    const r = await listPropertyValuesHandler({ arguments: { key: "p" }, app: mockApp() });
    const data = JSON.parse(r.content[0].text as string);
    expect(data.totalDistinct).toBe(2);
    const values = data.values.map((v: { value: unknown }) => v.value);
    expect(values).toContain(5);
    expect(values).toContain("5");
  });

  test("explodes list-valued frontmatter into per-element occurrences", async () => {
    seed("a.md", { tags: ["x", "y"] });
    seed("b.md", { tags: ["x"] });
    const r = await listPropertyValuesHandler({ arguments: { key: "tags" }, app: mockApp() });
    const data = JSON.parse(r.content[0].text as string);
    expect(data.values).toEqual([
      { value: "x", count: 2 },
      { value: "y", count: 1 },
    ]);
  });

  test("filters by folder prefix", async () => {
    seed("Projects/a.md", { status: "active" });
    seed("Archive/b.md", { status: "active" });
    const r = await listPropertyValuesHandler({ arguments: { key: "status", folder: "Projects" }, app: mockApp() });
    const data = JSON.parse(r.content[0].text as string);
    expect(data.totalDistinct).toBe(1);
    expect(data.values).toEqual([{ value: "active", count: 1 }]);
  });

  test("truncates to limit and reports totalDistinct", async () => {
    seed("a.md", { k: "v1" });
    seed("b.md", { k: "v2" });
    seed("c.md", { k: "v3" });
    const r = await listPropertyValuesHandler({ arguments: { key: "k", limit: 2 }, app: mockApp() });
    const data = JSON.parse(r.content[0].text as string);
    expect(data.values.length).toBe(2);
    expect(data.truncated).toBe(true);
    expect(data.totalDistinct).toBe(3);
  });

  test("returns empty wrapper when no note has the key", async () => {
    seed("a.md", { other: "x" });
    const r = await listPropertyValuesHandler({ arguments: { key: "absent" }, app: mockApp() });
    const data = JSON.parse(r.content[0].text as string);
    expect(data).toEqual({ key: "absent", values: [], truncated: false, totalDistinct: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/obsidian-plugin && bun test src/features/mcp-tools/tools/listPropertyValues.test.ts`
Expected: FAIL — `Cannot find module "./listPropertyValues"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// listPropertyValues.ts
import { type } from "arktype";
import type { App, TFile } from "obsidian";

export const listPropertyValuesSchema = type({
  name: '"list_property_values"',
  arguments: {
    key: type("string>0").describe("Frontmatter (YAML) key whose distinct values to enumerate across the vault."),
    "folder?": type("string").describe("Optional vault-relative folder prefix; only notes under it are scanned. Empty/omitted = whole vault."),
    "limit?": type("number>0").describe("Max distinct values to return (default 500), ordered by count descending. If more exist, `truncated` is true and `totalDistinct` reports the full count."),
  },
}).describe(
  "Enumerates the distinct values of a single frontmatter (note property) key across the vault, with per-value occurrence counts and native types preserved. List-valued frontmatter contributes each element. Scans Obsidian's metadata cache only (no file I/O), so it scales to large vaults. To find which notes carry a given value, use `search_vault` with a DQL/JsonLogic query. Always read-only.",
);

export type ListPropertyValuesContext = {
  arguments: { key: string; folder?: string; limit?: number };
  app: App;
};

export async function listPropertyValuesHandler(ctx: ListPropertyValuesContext): Promise<{
  content: Array<{ type: "text"; text: string }>;
}> {
  const { key } = ctx.arguments;
  const limit = ctx.arguments.limit ?? 500;
  let prefix = ctx.arguments.folder ?? "";
  if (prefix && !prefix.endsWith("/")) prefix = prefix + "/";

  // Distinct-value counter keyed by a stable JSON serialisation so that
  // native types stay distinct (number 5 vs string "5") while still being
  // groupable. The original native value is kept alongside the count.
  const counts = new Map<string, { value: unknown; count: number }>();

  const record = (v: unknown): void => {
    const k = JSON.stringify(v);
    const entry = counts.get(k);
    if (entry) entry.count++;
    else counts.set(k, { value: v, count: 1 });
  };

  for (const file of ctx.app.vault.getMarkdownFiles()) {
    if (prefix && !file.path.startsWith(prefix)) continue;
    const fm = ctx.app.metadataCache.getFileCache(file as TFile)?.frontmatter as Record<string, unknown> | undefined;
    if (!fm || !Object.prototype.hasOwnProperty.call(fm, key)) continue;
    const raw = fm[key];
    if (Array.isArray(raw)) {
      for (const el of raw) record(el);
    } else {
      record(raw);
    }
  }

  const all = [...counts.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return JSON.stringify(a.value).localeCompare(JSON.stringify(b.value), "en");
  });
  const totalDistinct = all.length;
  const values = all.slice(0, limit);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ key, values, truncated: totalDistinct > limit, totalDistinct }, null, 2),
      },
    ],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/obsidian-plugin && bun test src/features/mcp-tools/tools/listPropertyValues.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/obsidian-plugin/src/features/mcp-tools/tools/listPropertyValues.ts packages/obsidian-plugin/src/features/mcp-tools/tools/listPropertyValues.test.ts
git commit -m "feat(note-properties): add list_property_values tool (scale-safe wrapper)"
```

---

### Task 5: Register the 4 tools

**Files:**
- Modify: `packages/obsidian-plugin/src/features/mcp-tools/index.ts`

Mirror the existing import + register pattern. Find how tools are registered (each existing tool has an `import { xHandler, xSchema } from "./tools/x"` near the top and a `tools.register(xSchema, (ctx) => xHandler({ ...ctx, app }))`-style call in the registration body). Match it exactly — read the file first to copy the precise call shape.

- [ ] **Step 1: Read the registration site**

Run: `sed -n '1,260p' packages/obsidian-plugin/src/features/mcp-tools/index.ts`
Identify (a) the import block and (b) the registration calls (search for `listTagsSchema` and `getFilesByTagSchema` — register the 4 new tools right after them, using the identical call shape those two use).

- [ ] **Step 2: Add imports**

Add near the other tool imports:

```ts
import { getNotePropertyHandler, getNotePropertySchema } from "./tools/getNoteProperty";
import { setNotePropertyHandler, setNotePropertySchema } from "./tools/setNoteProperty";
import { deleteNotePropertyHandler, deleteNotePropertySchema } from "./tools/deleteNoteProperty";
import { listPropertyValuesHandler, listPropertyValuesSchema } from "./tools/listPropertyValues";
```

- [ ] **Step 3: Add registrations**

Add 4 registration calls next to `getFilesByTagSchema` / `listTagsSchema`, copying the **exact** call shape used there (the way `ctx`/`app` is threaded must match the sibling calls verbatim — do not invent a new shape).

- [ ] **Step 4: Typecheck**

Run: `bun run check`
Expected: `Exited with code 0` for all packages.

- [ ] **Step 5: Commit**

```bash
git add packages/obsidian-plugin/src/features/mcp-tools/index.ts
git commit -m "feat(note-properties): register the 4 note-property tools"
```

---

### Task 6: Docs + final verification

**Files:**
- Modify: `CLAUDE.md` (tool count 30 → 34; add 4 rows to the Vault file management tool table)
- Modify: `CHANGELOG.md` (`[Unreleased]` → `### Added`)

- [ ] **Step 1: Update CLAUDE.md tool count**

Find every "30 total" / "Tools: 30" / "30 MCP tools" occurrence and change to 34. Run first:
`grep -n "30" CLAUDE.md | grep -iE "tool"` — update each hit that refers to the tool count.

- [ ] **Step 2: Add 4 rows to the Vault file management table in CLAUDE.md**

Add under the existing table rows:

```markdown
| `get_note_property` | Read one frontmatter key from a note (native type preserved; `null` if absent). |
| `set_note_property` | Set one frontmatter key (atomic; auto-inits the block; `value:null` deletes). |
| `delete_note_property` | Remove one frontmatter key (idempotent). |
| `list_property_values` | Enumerate distinct values of a frontmatter key across the vault, with counts. |
```

- [ ] **Step 3: Add the CHANGELOG entry**

Add at the top of `[Unreleased]`:

```markdown
### Added

- **Atomic frontmatter property tools (4).** `get_note_property`,
  `set_note_property`, `delete_note_property`, and `list_property_values`
  give single-key access to note frontmatter without the
  whole-block read-modify-write of `patch_vault_file targetType:"frontmatter"`.
  Writes go through Obsidian's atomic `processFrontMatter`; reads/enumeration
  use the metadata cache (no file I/O). `set_note_property` auto-inits a
  missing block and treats `value:null` as delete; `list_property_values`
  is scale-safe (`limit`/`truncated`/`totalDistinct`). Tool count 30 → 34.
  (ADR-0001)
```

- [ ] **Step 4: Full verification**

```bash
bun run check
bun run --cwd packages/obsidian-plugin build
cd packages/obsidian-plugin && bun test && cd ../..
cd packages/shared && bun test && cd ../..
bun run format:check
```
Expected: check exit 0; build "Build successful"; plugin tests all pass (existing + ~24 new); shared tests pass; format:check clean.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md CHANGELOG.md
git commit -m "docs(note-properties): bump tool count 30->34 + CHANGELOG"
```

---

## Manual smoke + soak (post-merge gate, per spec DoD)

Not a code task — tracked here so it isn't forgotten:

- [ ] `bun run link` into the TEST vault, enable plugin, exercise each of the 4 tools from Claude Desktop on a real note (set a number, a bool, a list; read back; delete; list values across the vault).
- [ ] Pre-release BRAT branch posted to folotp + marcoaperez with the per-tool happy + edge checklist and the chain-discriminator preamble (CLAUDE.md "Soak preflight"). Wait 1–2 days before merge.

---

## Self-Review

**1. Spec coverage (Module D):**
- 4 tools (get/set/delete/list) — Tasks 1-4. ✓
- Value union `string | number | boolean | string[] | number[]` + ISO date string — Task 2 schema (+ `null` for delete redirect). ✓
- `set` auto-inits FM — Task 2 (auto-init test). ✓
- `value:null` → delete — Task 2 (delete-redirect test). ✓
- `invalid_key` pre-validation — Task 2 (invalid_key test, asserts no write). ✓
- `delete` idempotent — Task 3. ✓
- `file_not_found` on missing path — Tasks 1/2/3. ✓
- `list_property_values` wrapper `{values:[{value,count}],truncated,totalDistinct}` + `folder` + `limit=500` + native-type preservation + list explosion — Task 4. ✓
- Registration — Task 5. ✓
- Tool count 30→34 + CHANGELOG — Task 6. ✓
- DoD strict soak — captured as a post-merge manual gate. ✓

**2. Placeholder scan:** No "TBD"/"add error handling"/"similar to" — every code step has complete code. The one deferred item (malformed-FM diagnosis) is explicitly documented as a deliberate design choice with rationale, not a gap.

**3. Type consistency:** `value` union identical in Task 2 schema, `SetNotePropertyContext`, and the `value:null` branch. Return shape `{content,isError?}` consistent across Tasks 1-3; Task 4 omits `isError?` (it has no error path — pure read, empty wrapper for no-match). `errorCode` strings (`file_not_found`, `invalid_key`) consistent. Handler/schema export names match the import block in Task 5.

**Known intentional deviation from spec:** `get_note_property` returns `value:null` for a malformed frontmatter block rather than erroring (metadata-cache path can't distinguish malformed from absent without file I/O). Documented inline in Task 1; the richer diagnosis stays with `get_vault_file_partial`. Worth a one-line confirmation at review.
