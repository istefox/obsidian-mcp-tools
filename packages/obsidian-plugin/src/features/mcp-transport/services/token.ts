import { randomBytes, timingSafeEqual } from "node:crypto";
import { TOKEN_BYTE_LENGTH } from "../constants";

/**
 * Generate a random bearer token using cryptographically secure random bytes.
 *
 * Converts 32 bytes of random data to base64url encoding for use in HTTP
 * Authorization headers.
 *
 * Args:
 *   None
 *
 * Returns:
 *   A base64url-encoded string of at least 32 characters.
 */
export function generateToken(): string {
  return randomBytes(TOKEN_BYTE_LENGTH).toString("base64url");
}

/**
 * Compare two bearer tokens using constant-time comparison.
 *
 * Uses crypto.timingSafeEqual to prevent timing attacks. Length check
 * is performed first to avoid calling timingSafeEqual with mismatched
 * lengths (which would throw).
 *
 * Args:
 *   a: First token string to compare.
 *   b: Second token string to compare.
 *
 * Returns:
 *   true if both tokens are identical, false otherwise.
 *
 * Raises:
 *   None (safe to call with arbitrary length mismatches).
 */
export function compareTokens(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  return timingSafeEqual(aBuf, bBuf);
}
