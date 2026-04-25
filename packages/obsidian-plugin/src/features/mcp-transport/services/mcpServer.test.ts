import { describe, expect, test, afterEach, beforeEach } from "bun:test";
import { mockApp, mockPlugin, resetMockVault } from "$/test-setup";
import { createMcpService, destroyMcpService, type McpService } from "./mcpServer";

beforeEach(() => resetMockVault());

const active: McpService[] = [];
afterEach(async () => {
  for (const s of active.splice(0)) await destroyMcpService(s);
});

describe("createMcpService", () => {
  test("exposes a request handler compatible with StreamableHTTPServerTransport", async () => {
    const svc = await createMcpService({ app: mockApp(), plugin: mockPlugin(), pluginVersion: "0.4.0-alpha.1" });
    active.push(svc);
    expect(typeof svc.handleRequest).toBe("function");
  });
});

describe("end-to-end: HTTP → McpServer", () => {
  test("tools/list responds with get_server_info registered", async () => {
    const { startHttpServer } = await import("./httpServer");
    const svc = await createMcpService({ app: mockApp(), plugin: mockPlugin(), pluginVersion: "0.4.0-alpha.1" });
    active.push(svc);

    const server = await startHttpServer({
      bearerToken: "t".repeat(32),
      requestHandler: svc.handleRequest,
    });

    try {
      const res = await fetch(`http://127.0.0.1:${server.port}/mcp`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${"t".repeat(32)}`,
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {},
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      const tools = body?.result?.tools ?? [];
      const names = tools.map((t: { name: string }) => t.name);
      expect(names).toContain("get_server_info");
    } finally {
      await new Promise<void>((r) => server.server.close(() => r()));
    }
  });

  test("tools/call get_server_info returns health payload", async () => {
    const { startHttpServer } = await import("./httpServer");
    const svc = await createMcpService({ app: mockApp(), plugin: mockPlugin(), pluginVersion: "0.4.0-alpha.1" });
    active.push(svc);

    const server = await startHttpServer({
      bearerToken: "t".repeat(32),
      requestHandler: svc.handleRequest,
    });

    try {
      const res = await fetch(`http://127.0.0.1:${server.port}/mcp`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${"t".repeat(32)}`,
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 42,
          method: "tools/call",
          params: {
            name: "get_server_info",
            arguments: {},
          },
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      const text = body?.result?.content?.[0]?.text as string;
      const parsed = JSON.parse(text);
      expect(parsed.status).toBe("ok");
      expect(parsed.version).toBe("0.4.0-alpha.1");
      expect(parsed.transport).toBe("streamable-http");
    } finally {
      await new Promise<void>((r) => server.server.close(() => r()));
    }
  });
});
