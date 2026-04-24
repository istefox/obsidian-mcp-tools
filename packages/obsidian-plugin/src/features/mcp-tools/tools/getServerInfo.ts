import { type } from "arktype";

export const getServerInfoSchema = type({
  name: '"get_server_info"',
  arguments: {},
}).describe("Returns health status and version of the MCP Connector server.");

export type GetServerInfoContext = {
  // `object` (not `Record<string, never>`) to match the ToolRegistry
  // constraint which uses `object` for no-arg tools (see toolRegistry.ts).
  arguments: object;
  pluginVersion: string;
};

export async function getServerInfoHandler(
  ctx: GetServerInfoContext,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const body = {
    status: "ok",
    version: ctx.pluginVersion,
    transport: "streamable-http",
  };
  return {
    content: [{ type: "text", text: JSON.stringify(body, null, 2) }],
  };
}
