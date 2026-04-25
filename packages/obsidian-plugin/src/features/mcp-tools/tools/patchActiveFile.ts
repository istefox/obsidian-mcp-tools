import { type } from "arktype";
import type { App, TFile } from "obsidian";
import {
  resolveHeadingPath,
  findBlockPositionFromCache,
  normalizeAppendBody,
  type PatchOperation,
} from "$/features/mcp-tools/services/patchHelpers";

export const patchActiveFileSchema = type({
  name: '"patch_active_file"',
  arguments: {
    operation: '"append"|"prepend"|"replace"',
    targetType: '"heading"|"block"|"frontmatter"',
    target: type("string>0").describe(
      "Heading name, block id, or frontmatter key (depending on targetType).",
    ),
    content: type("string").describe(
      "Content to apply (semantics depend on operation+targetType).",
    ),
    "targetDelimiter?": "string",
    "createTargetIfMissing?": "boolean",
  },
}).describe(
  "Patches the currently active note relative to a heading, block reference, or frontmatter key.",
);

export type PatchActiveFileContext = {
  arguments: {
    operation: PatchOperation;
    targetType: "heading" | "block" | "frontmatter";
    target: string;
    content: string;
    targetDelimiter?: string;
    createTargetIfMissing?: boolean;
  };
  app: App;
};

export async function patchActiveFileHandler(
  ctx: PatchActiveFileContext,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  const file = ctx.app.workspace.getActiveFile();
  if (!file) {
    return {
      content: [{ type: "text", text: "No active file." }],
      isError: true,
    };
  }
  return await applyPatch(ctx.app, file as TFile, ctx.arguments);
}

/**
 * Core patch logic — exported for reuse by patchVaultFile (T13). T13's handler
 * resolves the file by path, then delegates here.
 *
 * Per-target-type default for createTargetIfMissing (per source 0.3.7 fix +
 * upstream #71):
 *   heading + frontmatter → true  (preserve upstream 0.2.x behaviour)
 *   block → false  (fail loud on unresolved id; safer per #71 block-in-table
 *                   corruption risk)
 *
 * Args:
 *   app: Obsidian App instance.
 *   file: The TFile to patch.
 *   args: Patch parameters validated by patchActiveFileSchema.
 *
 * Returns:
 *   MCP result object, with isError=true on failure.
 */
export async function applyPatch(
  app: App,
  file: TFile,
  args: PatchActiveFileContext["arguments"],
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  // Block defaults to false to fail loud on unresolved block ids — avoids
  // silent corruption in block-in-table scenarios (upstream #71).
  const createIfMissing =
    args.createTargetIfMissing ?? args.targetType !== "block";
  const delimiter = args.targetDelimiter ?? "::";

  // --- frontmatter branch ---
  if (args.targetType === "frontmatter") {
    await app.fileManager.processFrontMatter(file, (fm) => {
      if (args.operation === "replace") {
        fm[args.target] = args.content;
      } else if (args.operation === "append") {
        const existing = fm[args.target];
        if (Array.isArray(existing)) {
          existing.push(args.content);
        } else if (typeof existing === "string") {
          fm[args.target] = existing + args.content;
        } else {
          fm[args.target] = args.content;
        }
      } else {
        // prepend
        const existing = fm[args.target];
        if (Array.isArray(existing)) {
          existing.unshift(args.content);
        } else if (typeof existing === "string") {
          fm[args.target] = args.content + existing;
        } else {
          fm[args.target] = args.content;
        }
      }
    });
    return { content: [{ type: "text", text: "OK" }] };
  }

  const fileContent = await app.vault.read(file);
  const lines = fileContent.split("\n");

  // --- heading branch ---
  if (args.targetType === "heading") {
    const fullPath = resolveHeadingPath(fileContent, args.target, delimiter);

    if (!fullPath && !createIfMissing) {
      return {
        content: [
          {
            type: "text",
            text: `Heading "${args.target}" not found and createTargetIfMissing=false.`,
          },
        ],
        isError: true,
      };
    }

    if (!fullPath) {
      // Target heading not found — append at EOF (createIfMissing=true path).
      const normalized = normalizeAppendBody(args.content, args.operation);
      await app.vault.modify(file, fileContent + normalized);
      return { content: [{ type: "text", text: "OK" }] };
    }

    // Resolve the leaf name from the full path and locate the heading line.
    const leafName = fullPath.split(delimiter).pop()!;
    let headingLine = -1;
    let headingLevel = 0;
    for (let i = 0; i < lines.length; i++) {
      const m = /^(#+)\s+(.+?)\s*$/.exec(lines[i]);
      if (m && m[2].trim() === leafName) {
        headingLine = i;
        headingLevel = m[1].length;
        break;
      }
    }

    // Find end of this heading's section: next heading at same-or-higher level.
    let sectionEnd = lines.length;
    for (let i = headingLine + 1; i < lines.length; i++) {
      const m = /^(#+)\s+/.exec(lines[i]);
      if (m && m[1].length <= headingLevel) {
        sectionEnd = i;
        break;
      }
    }

    if (args.operation === "append") {
      // Insert at end of section, just before sectionEnd.
      // normalizeAppendBody adds trailing "\n\n" — strip the last "\n" so
      // splice doesn't introduce a blank line before the next heading.
      const normalized = normalizeAppendBody(args.content, "append");
      lines.splice(sectionEnd, 0, normalized.replace(/\n$/, ""));
    } else if (args.operation === "prepend") {
      lines.splice(headingLine + 1, 0, args.content);
    } else {
      // replace: swap out the section body between this heading and the next.
      lines.splice(headingLine + 1, sectionEnd - headingLine - 1, args.content);
    }

    await app.vault.modify(file, lines.join("\n"));
    return { content: [{ type: "text", text: "OK" }] };
  }

  // --- block branch ---
  if (args.targetType === "block") {
    const cache = app.metadataCache.getFileCache(file);
    const pos = findBlockPositionFromCache(cache, args.target);

    if (!pos && !createIfMissing) {
      return {
        content: [
          {
            type: "text",
            text: `Block "^${args.target}" not found in active file (createTargetIfMissing=false).`,
          },
        ],
        isError: true,
      };
    }

    if (!pos) {
      // Block not found — append at EOF (createIfMissing=true path).
      const normalized = normalizeAppendBody(args.content, args.operation);
      await app.vault.modify(file, fileContent + normalized);
      return { content: [{ type: "text", text: "OK" }] };
    }

    if (args.operation === "append") {
      lines.splice(pos.endLine + 1, 0, args.content);
    } else if (args.operation === "prepend") {
      lines.splice(pos.startLine, 0, args.content);
    } else {
      // replace: swap the lines from startLine to endLine (inclusive).
      lines.splice(pos.startLine, pos.endLine - pos.startLine + 1, args.content);
    }

    await app.vault.modify(file, lines.join("\n"));
    return { content: [{ type: "text", text: "OK" }] };
  }

  // Unreachable if ArkType validation ran correctly.
  return {
    content: [
      {
        type: "text",
        text: `Unknown targetType: ${(args as unknown as { targetType: string }).targetType}`,
      },
    ],
    isError: true,
  };
}
