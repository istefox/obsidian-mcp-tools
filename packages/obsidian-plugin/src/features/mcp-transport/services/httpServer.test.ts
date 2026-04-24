import { describe, expect, test, afterEach } from "bun:test";
import {
  startHttpServer,
  stopHttpServer,
  type RunningServer,
} from "./httpServer";

const running: RunningServer[] = [];
afterEach(async () => {
  for (const s of running.splice(0)) await stopHttpServer(s);
});

describe("startHttpServer", () => {
  test("binds to a port in range and exposes it", async () => {
    const server = await startHttpServer({
      bearerToken: "test-token-12345678901234567890abcd",
      requestHandler: async (_req, res) => {
        res.writeHead(200, { "content-type": "text/plain" });
        res.end("ok");
      },
    });
    running.push(server);
    expect(server.port).toBeGreaterThanOrEqual(27200);
    expect(server.port).toBeLessThanOrEqual(27205);
  });

  test("rejects POST /mcp without auth (401)", async () => {
    const server = await startHttpServer({
      bearerToken: "test-token-12345678901234567890abcd",
      requestHandler: async (_req, res) => {
        res.writeHead(200);
        res.end("should-not-reach");
      },
    });
    running.push(server);

    const res = await fetch(`http://127.0.0.1:${server.port}/mcp`, {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  test("rejects /other with 404", async () => {
    const server = await startHttpServer({
      bearerToken: "t".repeat(32),
      requestHandler: async (_req, res) => {
        res.end();
      },
    });
    running.push(server);

    const res = await fetch(`http://127.0.0.1:${server.port}/other`);
    expect(res.status).toBe(404);
  });

  test("rejects PUT /mcp with 405", async () => {
    const server = await startHttpServer({
      bearerToken: "t".repeat(32),
      requestHandler: async (_req, res) => {
        res.end();
      },
    });
    running.push(server);

    const res = await fetch(`http://127.0.0.1:${server.port}/mcp`, {
      method: "PUT",
    });
    expect(res.status).toBe(405);
  });

  test("hands off authed request to the handler", async () => {
    let handlerCalled = false;
    const token = "t".repeat(32);
    const server = await startHttpServer({
      bearerToken: token,
      requestHandler: async (_req, res) => {
        handlerCalled = true;
        res.writeHead(200, { "content-type": "text/plain" });
        res.end("ok");
      },
    });
    running.push(server);

    const res = await fetch(`http://127.0.0.1:${server.port}/mcp`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(handlerCalled).toBe(true);
  });
});

describe("stopHttpServer", () => {
  test("closes the server so the port is free again", async () => {
    const server = await startHttpServer({
      bearerToken: "t".repeat(32),
      requestHandler: async (_req, res) => {
        res.end();
      },
    });
    await stopHttpServer(server);

    // Bind a new server to the same port — would fail if the first is still listening
    const server2 = await startHttpServer({
      bearerToken: "t".repeat(32),
      requestHandler: async (_req, res) => {
        res.end();
      },
    });
    running.push(server2);
    expect(server2.port).toBe(server.port);
  });
});
