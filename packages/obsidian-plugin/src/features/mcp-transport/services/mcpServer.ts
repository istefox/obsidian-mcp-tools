import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { App } from "obsidian";
import type McpToolsPlugin from "$/main";
import { ToolRegistryClass } from "./toolRegistry";
import type { ToolRegistry } from "./toolRegistry";
import { registerTools } from "$/features/mcp-tools";

export type McpServiceConfig = {
  app: App;
  plugin: McpToolsPlugin;
  pluginVersion: string;
};

export type McpService = {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  registry: ToolRegistry;
  handleRequest: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
};

/**
 * Create a fully wired MCP service: McpServer + ToolRegistry + StreamableHTTPServerTransport.
 *
 * Registers all tools from the mcp-tools feature, wires the ArkType-based
 * ToolRegistry handlers against the low-level Server instance (same pattern
 * as packages/mcp-server/src/features/core/index.ts), then connects the
 * StreamableHTTPServerTransport in stateless mode (sessionIdGenerator: undefined).
 *
 * The returned `handleRequest` is directly compatible with the `RequestHandler`
 * type expected by `startHttpServer` from httpServer.ts.
 *
 * @param config - Service configuration including the plugin version string.
 * @returns A fully wired McpService ready to serve HTTP requests.
 */
export async function createMcpService(
  config: McpServiceConfig,
): Promise<McpService> {
  const server = new McpServer(
    {
      name: "mcp-connector",
      version: config.pluginVersion,
    },
    {
      capabilities: {
        // Declare tools capability so the SDK allows tools/list and
        // tools/call request handler registration. Without this the SDK
        // throws "Server does not support tools" at setRequestHandler time.
        tools: {},
      },
    },
  );

  // ToolRegistryClass takes no constructor arguments — the McpServer is not
  // passed in; instead we manually wire list/dispatch handlers below, mirroring
  // the pattern in packages/mcp-server/src/features/core/index.ts.
  const registry = new ToolRegistryClass();

  // Register all plugin-side tools (get_server_info, …) into the registry.
  await registerTools(registry, {
    app: config.app,
    plugin: config.plugin,
    pluginVersion: config.pluginVersion,
  });

  // Wire the ArkType-based registry against the underlying SDK Server instance
  // so that tools/list and tools/call go through our registry (with boolean
  // coercion, error formatting, and disableByName support).
  server.server.setRequestHandler(ListToolsRequestSchema, registry.list);
  server.server.setRequestHandler(
    CallToolRequestSchema,
    async (request) => registry.dispatch(request.params, { server }),
  );

  // Stateless mode: sessionIdGenerator: undefined means no session tracking.
  // Each request is independent — appropriate for a single-user local server
  // where clients (Claude Desktop, Claude Code) connect on demand.
  //
  // enableJsonResponse: true — return plain JSON-RPC responses instead of SSE
  // streams. For our use case (single-user local plugin), SSE streaming adds no
  // value and complicates clients that parse the response with res.json().
  // The SDK also supports this mode explicitly for environments where SSE is
  // not required.
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);

  const handleRequest = async (
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> => {
    await transport.handleRequest(req, res);
  };

  return { server, transport, registry, handleRequest };
}

/**
 * Gracefully shut down an McpService.
 *
 * Closes the transport first (stops accepting new requests) then the server
 * (releases internal resources). Order matters: closing the server first could
 * leave the transport in a half-open state.
 *
 * @param svc - The McpService returned by createMcpService.
 */
export async function destroyMcpService(svc: McpService): Promise<void> {
  await svc.transport.close();
  await svc.server.close();
}
