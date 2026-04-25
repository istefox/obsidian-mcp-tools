import { type } from "arktype";
import type { App, TFile } from "obsidian";
import {
  applyPatch,
  type PatchArgs,
} from "$/features/mcp-tools/services/patchHelpers";

export const patchVaultFileSchema = type({
  name: '"patch_vault_file"',
  arguments: {
    path: type("string>0").describe("Vault-relative path to the file to patch."),
    operation: '"append"|"prepend"|"replace"',
    targetType: '"heading"|"block"|"frontmatter"',
    target: type("string>0").describe(
      "Heading name, block id (without ^), or frontmatter key.",
    ),
    content: type("string").describe("Content to apply."),
    "targetDelimiter?": type("string").describe(
      "Delimiter used to join ancestor heading names (default: '::').",
    ),
    "createTargetIfMissing?": type("boolean").describe(
      "When true, creates the target if not found. Defaults to true for heading/frontmatter, false for block.",
    ),
  },
}).describe(
  "Patches a vault file relative to a heading, block reference, or frontmatter key. Unlike patch_active_file, operates on any file by vault-relative path.",
);

export type PatchVaultFileContext = {
  arguments: {
    path: string;
    operation: "append" | "prepend" | "replace";
    targetType: "heading" | "block" | "frontmatter";
    target: string;
    content: string;
    targetDelimiter?: string;
    createTargetIfMissing?: boolean;
  };
  app: App;
};

/**
 * Handler for the patch_vault_file MCP tool. Resolves the file by vault-relative
 * path and delegates to the shared applyPatch helper.
 *
 * Args:
 *   ctx: Context containing the vault App and the tool arguments.
 *
 * Returns:
 *   An MCP result object. Sets isError: true if the file is not found or if
 *   the patch operation fails (e.g., block not found with createTargetIfMissing=false).
 */
export async function patchVaultFileHandler(
  ctx: PatchVaultFileContext,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  const file = ctx.app.vault.getAbstractFileByPath(ctx.arguments.path);
  if (!file) {
    return {
      content: [
        {
          type: "text",
          text: `File not found: ${ctx.arguments.path}`,
        },
      ],
      isError: true,
    };
  }

  // Strip `path` from the arguments before forwarding — applyPatch only needs
  // the patch-specific fields (operation, targetType, target, content, …).
  const { path: _path, ...patchArgs } = ctx.arguments;
  return await applyPatch(ctx.app, file as TFile, patchArgs as PatchArgs);
}
