import { ALLOWED_ORIGINS_PATTERN } from "../constants";

/**
 * Validates whether an Origin header is allowed for the MCP transport server.
 *
 * Allows:
 * - Missing/null/undefined Origin (non-browser clients don't send Origin header)
 * - http://127.0.0.1 with optional port
 * - http://localhost with optional port
 * - https variants of the above
 *
 * Rejects:
 * - Any non-loopback IP (private or public)
 * - Special schemes like file://, chrome-extension://, etc.
 * - Loopback-looking strings that are not exact prefix matches (e.g., localhost.attacker.com)
 *
 * @param origin - The Origin header value, or null/undefined if missing
 * @returns true if the origin is allowed, false otherwise
 */
export function isOriginAllowed(origin: string | null | undefined): boolean {
  if (origin == null) return true;
  return ALLOWED_ORIGINS_PATTERN.test(origin);
}
