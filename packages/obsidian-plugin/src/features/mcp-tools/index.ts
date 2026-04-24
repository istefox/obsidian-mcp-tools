import type { ToolRegistry } from "$/features/mcp-transport/services/toolRegistry";
import { getServerInfoHandler, getServerInfoSchema } from "./tools/getServerInfo";

export type RegisterToolsContext = {
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
