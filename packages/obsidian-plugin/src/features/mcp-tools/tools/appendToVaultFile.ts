import { type } from "arktype";
import type { App, TFile } from "obsidian";
import { normalizeAppendBody } from "$/features/mcp-tools/services/patchHelpers";
import { ensureParentFolderExists } from "$/features/mcp-tools/services/ensureFolderExists";

export const appendToVaultFileSchema = type({
  name: '"append_to_vault_file"',
  arguments: {
    path: type("string>0").describe(
      "Vault-relative path. Any missing parent directories are created automatically when the file does not exist.",
    ),
    content: type("string").describe("Markdown content to append."),
  },
}).describe(
  "Appends content to a vault file. Creates the file (and any missing parent directories) if it does not exist.",
);

export type AppendToVaultFileContext = {
  arguments: { path: string; content: string };
  app: App;
};

export async function appendToVaultFileHandler(
  ctx: AppendToVaultFileContext,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  const normalized = normalizeAppendBody(ctx.arguments.content, "append");
  const existing = ctx.app.vault.getAbstractFileByPath(ctx.arguments.path);

  if (existing) {
    const tfile = existing as TFile;
    const current = await ctx.app.vault.read(tfile);
    await ctx.app.vault.modify(tfile, current + normalized);
  } else {
    await ensureParentFolderExists(ctx.app, ctx.arguments.path);
    await ctx.app.vault.create(ctx.arguments.path, normalized);
  }
  return { content: [{ type: "text", text: "OK" }] };
}
