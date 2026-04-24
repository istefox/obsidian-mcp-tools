import { ERROR_CODES, MCP_PATH_PREFIX } from "../constants";

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
