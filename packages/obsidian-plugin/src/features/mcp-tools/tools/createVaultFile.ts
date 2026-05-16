import { type } from "arktype";
import type { App, TFile } from "obsidian";
import { ensureParentFolderExists } from "$/features/mcp-tools/services/ensureFolderExists";

export const createVaultFileSchema = type({
  name: '"create_vault_file"',
  arguments: {
    path: type("string>0").describe(
      "Vault-relative path including extension (e.g. 'Notes/new.md'). Any missing parent directories are created automatically.",
    ),
    content: type("string").describe(
      "Full content of the file. If the path already exists, the content is overwritten.",
    ),
  },
}).describe(
  "Creates a new file at the given vault-relative path. Overwrites the file if it already exists. Missing parent directories along the path are created automatically.",
);

export type CreateVaultFileContext = {
  arguments: { path: string; content: string };
  app: App;
};

export async function createVaultFileHandler(
  ctx: CreateVaultFileContext,
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const existing = ctx.app.vault.getAbstractFileByPath(ctx.arguments.path);
  if (existing) {
    await ctx.app.vault.modify(existing as TFile, ctx.arguments.content);
  } else {
    await ensureParentFolderExists(ctx.app, ctx.arguments.path);
    await ctx.app.vault.create(ctx.arguments.path, ctx.arguments.content);
  }
  return { content: [{ type: "text", text: "OK" }] };
}
