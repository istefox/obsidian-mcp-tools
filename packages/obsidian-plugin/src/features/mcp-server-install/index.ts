import { Plugin } from "obsidian";
import type { SetupResult } from "./types";

export function setup(_plugin: Plugin): Promise<SetupResult> {
  try {
    return Promise.resolve({ success: true });
  } catch (error) {
    return Promise.resolve({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// 0.4.0: the FeatureSettings re-export is gone. The 0.3.x settings
// component (McpServerInstallSettings.svelte) was retired in this
// release — the in-process MCP server has no install/uninstall flow.
//
// What stays exported here is what the migration UX (Phase 4) and
// internal callers still rely on: legacy install paths via
// `./constants` (used by the migration detector to find an orphan
// 0.3.x binary on disk), `updateClaudeConfig` (used by both the
// migration step that rewrites the legacy config entry and by the
// new `mcp-client-config` feature), `uninstallServer` (used by the
// migration step that deletes the orphan binary), and the
// `installMcpServer` orchestration wrapper kept as a rollback path
// in case a 0.4.x patch needs to re-introduce a binary install
// flow.
export * from "./constants";
export { updateClaudeConfig } from "./services/config";
export { installMcpServer } from "./services/install";
export { uninstallServer } from "./services/uninstall";
export * from "./types";
