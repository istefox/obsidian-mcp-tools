import type { Server } from "node:http";
import { BIND_HOST } from "../constants";

export async function bindWithFallback(
  server: Server,
  ports: readonly number[],
): Promise<number> {
  for (const port of ports) {
    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (err: NodeJS.ErrnoException) => {
          server.off("listening", onListening);
          reject(err);
        };
        const onListening = () => {
          server.off("error", onError);
          resolve();
        };
        // Register both handlers BEFORE calling listen() to avoid
        // missing events on fast-failing ports
        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(port, BIND_HOST);
      });
      return port;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EADDRINUSE") throw err;
      // Port is taken — try the next one in the range
    }
  }
  throw new Error(`No free port in range: ${ports.join(", ")}`);
}
