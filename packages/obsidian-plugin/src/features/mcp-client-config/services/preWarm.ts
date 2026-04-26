import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "$/shared/logger";

/**
 * `mcp-remote` pre-warm (Phase 4 T10).
 *
 * The Claude Desktop bridge runs `npx -y mcp-remote ...` at every
 * launch; if the package is not in the npm cache, the first invocation
 * is a 20-60 s pause while it downloads. The Settings UI exposes a
 * "Pre-warm now" button that runs `npx -y mcp-remote@latest --help`
 * once, populating the cache. Subsequent Claude Desktop launches hit
 * the cache and are near-instant.
 *
 * Read-only of the user's filesystem (npm cache lives under
 * `~/.npm/_npx`). Network egress: required (npm registry). Idempotent:
 * re-running just bumps `lastWarmedAt`.
 *
 * Persistence: `data.json` slice
 * `mcpClientConfig.mcpRemotePreWarm = { lastWarmedAt, version? }`.
 */

const DATA_KEY = "mcpClientConfig";
const SLICE_KEY = "mcpRemotePreWarm";

/** Timeout for the prewarm shell call. Generous — first run can be slow. */
const PREWARM_TIMEOUT_MS = 120_000;

export type PreWarmCacheEntry = {
  lastWarmedAt: string;
  version?: string;
};

export type PreWarmResult =
  | { ok: true; entry: PreWarmCacheEntry }
  | { ok: false; error: string };

export type ExecRunner = (
  command: string,
  options?: { timeout?: number },
) => Promise<{ stdout: string; stderr: string }>;

const defaultRunner: ExecRunner = (command, options) => {
  const exec_ = promisify(exec) as (
    cmd: string,
    opts?: { timeout?: number },
  ) => Promise<{ stdout: string; stderr: string }>;
  return exec_(command, options);
};

type PluginLike = {
  loadData: () => Promise<unknown>;
  saveData: (data: unknown) => Promise<void>;
};

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export async function getPreWarmCache(
  plugin: PluginLike,
): Promise<PreWarmCacheEntry | null> {
  const data = (await plugin.loadData()) as Record<string, unknown> | null;
  if (!data || typeof data !== "object") return null;
  const slice = data[DATA_KEY];
  if (!slice || typeof slice !== "object") return null;
  const entry = (slice as Record<string, unknown>)[SLICE_KEY];
  if (!entry || typeof entry !== "object") return null;
  const e = entry as Record<string, unknown>;
  if (typeof e.lastWarmedAt !== "string") return null;
  return {
    lastWarmedAt: e.lastWarmedAt,
    ...(typeof e.version === "string" ? { version: e.version } : {}),
  };
}

async function persistPreWarmCache(
  plugin: PluginLike,
  entry: PreWarmCacheEntry,
): Promise<void> {
  const data =
    ((await plugin.loadData()) as Record<string, unknown> | null) ?? {};
  const slice = (data[DATA_KEY] as Record<string, unknown> | undefined) ?? {};
  await plugin.saveData({
    ...data,
    [DATA_KEY]: { ...slice, [SLICE_KEY]: entry },
  });
}

// ---------------------------------------------------------------------------
// Pre-warm action
// ---------------------------------------------------------------------------

/**
 * Run `npx -y mcp-remote@latest --help` and persist the timestamp on
 * success. Returns a structured result the UI can render directly.
 *
 * Args:
 *   plugin: data persistence handle.
 *   runner: optional override for tests.
 */
export async function preWarm(
  plugin: PluginLike,
  opts?: { runner?: ExecRunner },
): Promise<PreWarmResult> {
  const runner = opts?.runner ?? defaultRunner;
  try {
    const { stdout, stderr } = await runner(
      "npx -y mcp-remote@latest --help",
      { timeout: PREWARM_TIMEOUT_MS },
    );

    // `mcp-remote` prints its help banner to stdout; some versions
    // include the version line ("mcp-remote 0.x.y"). Best-effort
    // parse — the success of the install is what matters, not the
    // version string. We log stderr at debug level for diagnostics.
    if (stderr) {
      logger.debug("preWarm: stderr from mcp-remote --help", {
        stderr: stderr.slice(0, 200),
      });
    }
    const version = parseVersionFromHelp(stdout);
    const entry: PreWarmCacheEntry = {
      lastWarmedAt: new Date().toISOString(),
      ...(version ? { version } : {}),
    };
    await persistPreWarmCache(plugin, entry);
    return { ok: true, entry };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: classifyError(message) };
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Best-effort parse of the version from `--help` output. Tolerant of
 * unfamiliar shapes — a successful pre-warm is meaningful even if we
 * cannot read the version.
 */
function parseVersionFromHelp(stdout: string): string | undefined {
  const m = /mcp-remote[\s/@v]+(\d+\.\d+\.\d+(?:-[A-Za-z0-9.+]+)?)/i.exec(
    stdout,
  );
  return m?.[1];
}

function classifyError(message: string): string {
  if (/ENOENT|not found|not recognized/i.test(message)) {
    return "npx not available — install Node.js from nodejs.org first.";
  }
  if (/ETIMEDOUT|timed out/i.test(message)) {
    return "Timed out reaching the npm registry. Check your network and retry.";
  }
  if (/ENETUNREACH|getaddrinfo|EAI_AGAIN/i.test(message)) {
    return "Could not reach the npm registry. Check your network and retry.";
  }
  return `Pre-warm failed: ${message}`;
}
