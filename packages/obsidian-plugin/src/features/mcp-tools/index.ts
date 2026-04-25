import type { App } from "obsidian";
import type McpToolsPlugin from "$/main";
import type { ToolRegistry } from "$/features/mcp-transport/services/toolRegistry";
import { getServerInfoHandler, getServerInfoSchema } from "./tools/getServerInfo";

export type RegisterToolsContext = {
  app: App;
  plugin: McpToolsPlugin;
  pluginVersion: string;
};

export async function registerTools(
  registry: ToolRegistry,
  ctx: RegisterToolsContext,
): Promise<void> {
  registry.register(getServerInfoSchema, async ({ arguments: args }) =>
    getServerInfoHandler({ arguments: args, pluginVersion: ctx.pluginVersion }),
  );
}
