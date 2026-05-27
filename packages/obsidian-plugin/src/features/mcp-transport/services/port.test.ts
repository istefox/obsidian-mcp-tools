import { describe, expect, test, afterEach } from "bun:test";
import { createServer, type Server } from "node:http";
import { bindWithFallback } from "./port";

const openServers: Server[] = [];

afterEach(async () => {
  for (const s of openServers.splice(0))
    await new Promise<void>((r) => s.close(() => r()));
});

/** Acquire n OS-assigned free ports via bind-and-release (port 0). */
async function freePorts(n: number): Promise<number[]> {
  const ports: number[] = [];
  for (let i = 0; i < n; i++) {
    ports.push(
      await new Promise<number>((resolve, reject) => {
        const s = createServer();
        s.listen(0, "127.0.0.1", () => {
          const { port } = s.address() as { port: number };
          s.close(() => resolve(port));
        });
        s.on("error", reject);
      }),
    );
  }
  return ports;
}

describe("bindWithFallback", () => {
  test("binds to the first port in the range when free", async () => {
    const [port] = await freePorts(1);
    const server = createServer();
    openServers.push(server);
    const bound = await bindWithFallback(server, [port]);
    expect(bound).toBe(port);
  });

  test("falls back to the next port when the first is taken", async () => {
    const [port1, port2] = await freePorts(2);

    const blocker = createServer();
    openServers.push(blocker);
    await new Promise<void>((r) =>
      blocker.listen(port1, "127.0.0.1", () => r()),
    );

    const server = createServer();
    openServers.push(server);
    const bound = await bindWithFallback(server, [port1, port2]);
    expect(bound).toBe(port2);
  });

  test("throws when all ports in range are taken", async () => {
    const ports = await freePorts(3);
    const blockers = ports.map(() => createServer());
    openServers.push(...blockers);
    await Promise.all(
      blockers.map(
        (s, i) =>
          new Promise<void>((r) => s.listen(ports[i], "127.0.0.1", () => r())),
      ),
    );

    const server = createServer();
    openServers.push(server);
    await expect(bindWithFallback(server, ports)).rejects.toThrow(
      /no free port/i,
    );
  });
});
