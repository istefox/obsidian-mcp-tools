import { ERROR_CODES, MCP_PATH_PREFIX } from "../constants";
import { isOriginAllowed } from "./origin";
import { compareTokens } from "./token";

export type MethodPathResult =
  | { ok: true }
  | { ok: false; status: 404 | 405 };

const ALLOWED_METHODS = new Set(["GET", "POST"]);

export function checkMethodAndPath(
  method: string | undefined,
  url: string | undefined,
): MethodPathResult {
  const path = (url ?? "").split("?")[0];

  // Check path first: 404 takes precedence over 405
  if (path !== MCP_PATH_PREFIX && !path.startsWith(`${MCP_PATH_PREFIX}/`)) {
    return { ok: false, status: ERROR_CODES.NOT_FOUND };
  }

  // Check method second: only if path is valid
  if (!ALLOWED_METHODS.has((method ?? "").toUpperCase())) {
    return { ok: false, status: ERROR_CODES.METHOD_NOT_ALLOWED };
  }

  return { ok: true };
}

export type RequestHeaders = Record<string, string | string[] | undefined>;

export type MiddlewareRequest = {
  method: string | undefined;
  url: string | undefined;
  headers: RequestHeaders;
};

export type MiddlewareResult =
  | { ok: true }
  | { ok: false; status: 401 | 403 | 404 | 405 };

function getHeader(headers: RequestHeaders, name: string): string | undefined {
  const v = headers[name.toLowerCase()];
  return Array.isArray(v) ? v[0] : v;
}

function checkAuth(
  headers: RequestHeaders,
  expectedToken: string,
): MiddlewareResult {
  const auth = getHeader(headers, "authorization");
  if (!auth) return { ok: false, status: ERROR_CODES.UNAUTHORIZED };
  const match = /^Bearer\s+(.+)$/.exec(auth);
  if (!match) return { ok: false, status: ERROR_CODES.UNAUTHORIZED };
  const token = match[1].trim();
  if (!compareTokens(token, expectedToken)) {
    return { ok: false, status: ERROR_CODES.UNAUTHORIZED };
  }
  return { ok: true };
}

function checkOrigin(headers: RequestHeaders): MiddlewareResult {
  const origin = getHeader(headers, "origin");
  return isOriginAllowed(origin)
    ? { ok: true }
    : { ok: false, status: ERROR_CODES.ORIGIN_FORBIDDEN };
}

export function runMiddleware(
  req: MiddlewareRequest,
  bearerToken: string,
): MiddlewareResult {
  const methodPath = checkMethodAndPath(req.method, req.url);
  if (!methodPath.ok) return methodPath;

  const origin = checkOrigin(req.headers);
  if (!origin.ok) return origin;

  const auth = checkAuth(req.headers, bearerToken);
  if (!auth.ok) return auth;

  return { ok: true };
}
