/**
 * In-memory tumbling-window rate limiter for `execute_obsidian_command`.
 *
 * Ported from `packages/mcp-server/src/features/commands/services/rateLimit.ts`
 * into the plugin so the in-process MCP transport can enforce the same
 * 100/min hard limit without depending on the external server binary.
 *
 * State is per-plugin-load and in-memory. Reloading the plugin resets
 * the counter, which is acceptable — the goal is to catch short bursts,
 * not enforce long-term quotas.
 *
 * Design mirrors the server-side implementation: tumbling window keyed
 * by `Math.floor(now / windowMs) * windowMs`. Each call either consumes
 * a slot or returns a retry hint when the window is full.
 */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 100;

/** Module-level mutable state for the current window. */
let windowStart = 0;
let count = 0;

/**
 * Consume one rate-limit slot. Returns `{ ok: true }` when a slot is
 * available, or `{ ok: false, retryAfterMs }` when the window is full.
 *
 * The check is a pure tumbling window: on the first call after a new
 * window starts, the counter resets automatically. No background timer
 * needed.
 */
export function rateLimitTake(): { ok: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const currentWindowStart = Math.floor(now / WINDOW_MS) * WINDOW_MS;

  if (currentWindowStart !== windowStart) {
    // Transition into a new window — reset the counter.
    windowStart = currentWindowStart;
    count = 0;
  }

  if (count >= MAX_PER_WINDOW) {
    const retryAfterMs = windowStart + WINDOW_MS - now;
    return { ok: false, retryAfterMs };
  }

  count += 1;
  return { ok: true };
}

/**
 * Reset module-level state to the zero epoch, clearing both the window
 * start and the call count. For tests only — never call from production
 * code.
 */
export function _resetRateLimitForTests(): void {
  windowStart = 0;
  count = 0;
}
