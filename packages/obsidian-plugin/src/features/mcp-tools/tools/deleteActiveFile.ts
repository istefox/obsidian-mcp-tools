import { type } from "arktype";
import type { App } from "obsidian";

export const deleteActiveFileSchema = type({
  name: '"delete_active_file"',
  arguments: {},
}).describe("Deletes the currently active note from the vault.");

export type DeleteActiveFileContext = {
  arguments: Record<string, never>;
  app: App;
};

export async function deleteActiveFileHandler(
  ctx: DeleteActiveFileContext,
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const file = ctx.app.workspace.getActiveFile();
  if (!file) {
    return {
      content: [{ type: "text", text: "No active file." }],
      isError: true,
    };
  }
  await ctx.app.vault.delete(file);
  return { content: [{ type: "text", text: "OK" }] };
}
