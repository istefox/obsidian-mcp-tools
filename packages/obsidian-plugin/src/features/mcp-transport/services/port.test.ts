import { describe, expect, test, afterEach } from "bun:test";
import { createServer, type Server } from "node:http";
import { bindWithFallback } from "./port";
import { PORT_RANGE } from "../constants";

const openServers: Server[] = [];

afterEach(async () => {
  for (const s of openServers.splice(0))
    await new Promise<void>((r) => s.close(() => r()));
});

describe("bindWithFallback", () => {
  test("binds to the first port in the range when free", async () => {
    const server = createServer();
    openServers.push(server);
    const port = await bindWithFallback(server, [...PORT_RANGE]);
    expect(port).toBe(PORT_RANGE[0]);
  });

  test("falls back to the next port when the first is taken", async () => {
    const blocker = createServer();
    openServers.push(blocker);
    await new Promise<void>((r) =>
      blocker.listen(PORT_RANGE[0], "127.0.0.1", () => r()),
    );

    const server = createServer();
    openServers.push(server);
    const port = await bindWithFallback(server, [...PORT_RANGE]);
    expect(port).toBe(PORT_RANGE[1]);
  });

  test("throws when all ports in range are taken", async () => {
    const blockers = PORT_RANGE.map(() => createServer());
    openServers.push(...blockers);
    await Promise.all(
      blockers.map(
        (s, i) =>
          new Promise<void>((r) =>
            s.listen(PORT_RANGE[i], "127.0.0.1", () => r()),
          ),
      ),
    );

    const server = createServer();
    openServers.push(server);
    await expect(bindWithFallback(server, [...PORT_RANGE])).rejects.toThrow(
      /no free port/i,
    );
  });
});
