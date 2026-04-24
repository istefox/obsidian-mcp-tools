import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { runMiddleware } from "./middleware";
import { bindWithFallback } from "./port";
import { PORT_RANGE } from "../constants";

export type RequestHandler = (
  req: IncomingMessage,
  res: ServerResponse,
) => Promise<void>;

export type HttpServerConfig = {
  bearerToken: string;
  requestHandler: RequestHandler;
};

export type RunningServer = {
  server: Server;
  port: number;
};

/**
 * Start an HTTP server bound to 127.0.0.1 on the first available port
 * in PORT_RANGE.
 *
 * The server runs a middleware chain (method/path → origin → bearer auth)
 * before delegating to the caller-provided requestHandler. This keeps auth
 * concerns out of the handler entirely — the handler only sees requests that
 * have already passed all checks.
 *
 * Unhandled handler errors return 500 to the client and rethrow so that the
 * Node uncaughtException handler (wired in Task 12's logger setup) can see
 * them.
 *
 * @param config - Bearer token and the request handler to call on valid requests.
 * @returns A RunningServer with the bound server instance and its port.
 */
export async function startHttpServer(
  config: HttpServerConfig,
): Promise<RunningServer> {
  const server = createServer((req, res) => {
    const check = runMiddleware(
      { method: req.method, url: req.url, headers: req.headers },
      config.bearerToken,
    );

    if (!check.ok) {
      // Middleware rejected the request — return the status and close.
      // No body needed: these are machine-to-machine errors.
      res.writeHead(check.status);
      res.end();
      return;
    }

    // void prefix: fire-and-forget is intentional. Errors are caught
    // below and logged without rethrowing.
    void config.requestHandler(req, res).catch((err) => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
      // TODO(Task 12): replace with logger.error("handler failed", { err })
      // Intentionally NOT rethrowing: inside a .catch() of a void-prefixed
      // promise, throwing creates an unhandled rejection which crashes the
      // Electron renderer under default Node settings.
      // eslint-disable-next-line no-console
      console.error("[mcp-transport] request handler failed:", err);
    });
  });

  let port: number;
  try {
    port = await bindWithFallback(server, [...PORT_RANGE]);
  } catch (err) {
    // Best-effort cleanup; no-op if server never listened.
    try {
      server.close();
    } catch {
      /* ignore */
    }
    throw err;
  }
  return { server, port };
}

/**
 * Gracefully close the HTTP server and release its port.
 *
 * Resolves when the server has fully closed (all connections drained).
 * Rejects if the server was not listening or if close() emits an error.
 *
 * @param running - The RunningServer returned by startHttpServer.
 */
export async function stopHttpServer({ server }: RunningServer): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}
