import type { App } from "obsidian";

/**
 * Mkdirp-equivalent for the Obsidian vault. Walks every ancestor
 * segment of `folderPath` from the root downward and calls
 * `app.vault.createFolder` on the first segment that doesn't already
 * exist. `app.vault.create` (which writes a file) does NOT auto-create
 * missing parents — it bottoms out in the filesystem layer and throws
 * ENOENT — so any tool that takes a user-supplied path which may
 * include a not-yet-created subdirectory must call this first.
 *
 * - Idempotent: empty path or root is a no-op; existing folders are
 *   left alone.
 * - Tolerates the race where another caller created the same folder
 *   between our check and our write — Obsidian throws "Folder already
 *   exists" in that case, which we treat as success.
 * - Re-throws every other error so real failures (permissions, invalid
 *   characters, locked files) surface to the caller.
 */
export async function ensureFolderExists(
  app: App,
  folderPath: string,
): Promise<void> {
  if (!folderPath) return;
  const segments = folderPath.split("/").filter((s) => s.length > 0);
  if (segments.length === 0) return;

  let cursor = "";
  for (const segment of segments) {
    cursor = cursor ? `${cursor}/${segment}` : segment;
    if (app.vault.getAbstractFileByPath(cursor)) continue;
    try {
      await app.vault.createFolder(cursor);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // "Folder already exists" can race with a sibling caller; everything
      // else is a real failure (permissions, invalid path, etc.).
      if (!/already exists/i.test(msg)) throw e;
    }
  }
}

/**
 * Convenience wrapper for tools that take a file path: extracts the
 * parent directory and calls `ensureFolderExists` on it. No-op for
 * root-level paths.
 */
export async function ensureParentFolderExists(
  app: App,
  filePath: string,
): Promise<void> {
  const slash = filePath.lastIndexOf("/");
  if (slash <= 0) return;
  await ensureFolderExists(app, filePath.slice(0, slash));
}
