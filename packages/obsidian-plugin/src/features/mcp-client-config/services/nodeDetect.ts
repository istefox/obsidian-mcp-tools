import { exec } from "child_process";
import { promisify } from "util";

/**
 * Node.js presence + version detection (Phase 4 T9).
 *
 * Background: Claude Desktop's bridge to the in-process HTTP MCP
 * server goes through `npx mcp-remote`. `npx` requires Node.js on
 * PATH. The Settings UI shows a green check-or-not-detected hint so
 * the user can install Node before they paste the Claude Desktop
 * config and discover the failure at first launch.
 *
 * Read-only, no network. Spawns `node --version` once per session
 * (the cached result lasts until the next plugin load, which is
 * plenty for a UX hint — users rarely uninstall Node mid-session).
 *
 * Production callers use the default `runner` (the actual
 * `child_process.exec` wrapped in a promise). Tests inject a stubbed
 * runner so they do not depend on the host having Node on PATH.
 */

export type NodeDetectResult =
  | {
      found: true;
      /** Parsed version, e.g. "22.3.0". */
      version: string;
      /** Raw stdout including any trailing newline, for debug surfaces. */
      raw: string;
    }
  | {
      found: false;
      /** Human-readable failure cause for the UI hint. */
      error: string;
    };

export type ExecRunner = (command: string) => Promise<{
  stdout: string;
  stderr: string;
}>;

const defaultRunner: ExecRunner = promisify(exec) as unknown as ExecRunner;

let cached: NodeDetectResult | null = null;

/**
 * Detect Node.js. First call spawns `node --version`; subsequent calls
 * (in the same plugin load) return the cached result.
 *
 * Args:
 *   forceRefresh: bypass the cache. Used by the "Verify again" button.
 *   runner: override the exec runner. Tests use this; production omits.
 */
export async function detectNode(opts?: {
  forceRefresh?: boolean;
  runner?: ExecRunner;
}): Promise<NodeDetectResult> {
  if (!opts?.forceRefresh && cached !== null) return cached;
  const runner = opts?.runner ?? defaultRunner;

  try {
    const { stdout } = await runner("node --version");
    const raw = stdout;
    const version = parseVersion(stdout);
    if (!version) {
      cached = {
        found: false,
        error: `Unrecognized output from "node --version": ${stdout.slice(0, 80)}`,
      };
      return cached;
    }
    cached = { found: true, version, raw };
    return cached;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    cached = { found: false, error: classifyError(message) };
    return cached;
  }
}

/**
 * Reset the in-memory cache. Tests use this between cases. Production
 * code does not need it — there is no API for the user to "uncache"
 * the result; restarting the plugin is the canonical refresh.
 */
export function clearNodeDetectCache(): void {
  cached = null;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Parse the stdout of `node --version` into a bare semver string.
 * Examples:
 *   "v22.3.0\n" → "22.3.0"
 *   "v18.20.4"  → "18.20.4"
 *   "v22.0.0-nightly20240501"  → "22.0.0-nightly20240501"
 * Returns null if the output does not match the expected `vX.Y.Z[-pre]`
 * shape — the `node` binary may have been replaced with something
 * unexpected, so we fail closed.
 */
function parseVersion(stdout: string): string | null {
  const match = /v(\d+\.\d+\.\d+(?:-[A-Za-z0-9.+]+)?)/.exec(stdout.trim());
  return match?.[1] ?? null;
}

/**
 * Translate child_process.exec errors into a UI-friendly hint.
 * Common cases:
 *  - ENOENT / "command not found": Node is not on PATH.
 *  - non-zero exit code: present but broken (rare; surface raw).
 */
function classifyError(message: string): string {
  if (/ENOENT|not found|not recognized/i.test(message)) {
    return "Node.js not found on PATH. Install from nodejs.org.";
  }
  return `Failed to run "node --version": ${message}`;
}
