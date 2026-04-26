<script lang="ts">
  import type McpToolsPlugin from "$/main";
  import { Notice } from "obsidian";
  import { onMount } from "svelte";
  import { BIND_HOST, MCP_PATH_PREFIX } from "$/features/mcp-transport/constants";
  import {
    claudeCodeConfig,
    claudeDesktopConfig,
    streamableHttpConfig,
    wrapInMcpServers,
  } from "../services/generators";
  import {
    getAutoWriteEnabled,
    setAutoWriteEnabled,
    applyAutoWrite,
  } from "../services/autoWrite";

  /**
   * Settings UI for MCP client configuration.
   *
   * Three "Copy config" buttons emit ready-to-paste JSON for each
   * supported client family (design D6). An opt-in "Auto-write Claude
   * Desktop config" toggle, default OFF, lets the plugin keep
   * `claude_desktop_config.json` in sync on token rotation or port
   * change without manual paste — see `services/autoWrite.ts`.
   *
   * The bearer token + port come from the live `McpTransportState` on
   * the plugin. If the transport is not running (setup failed earlier
   * in plugin load) the buttons are disabled with a hint.
   */

  export let plugin: McpToolsPlugin;

  let token = "";
  let port = 0;
  let url = "";
  let autoWrite = false;
  let busy = false;

  $: {
    token = plugin.mcpTransportState?.bearerToken ?? "";
    port = plugin.mcpTransportState?.server.port ?? 0;
    url = port ? `http://${BIND_HOST}:${port}${MCP_PATH_PREFIX}` : "";
  }

  onMount(async () => {
    autoWrite = await getAutoWriteEnabled(plugin);
  });

  /**
   * Copy a JSON-serialized object to the clipboard. We pretty-print
   * with 2-space indent so the user can paste straight into a config
   * file and review the structure.
   */
  async function copyJson(payload: unknown, label: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      new Notice(`${label} config copied to clipboard.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      new Notice(`Copy failed: ${msg}`);
    }
  }

  function copyClaudeDesktop(): Promise<void> {
    return copyJson(
      wrapInMcpServers(claudeDesktopConfig({ url, token })),
      "Claude Desktop",
    );
  }

  function copyClaudeCode(): Promise<void> {
    return copyJson(
      wrapInMcpServers(claudeCodeConfig({ url, token })),
      "Claude Code",
    );
  }

  function copyStreamableHttp(): Promise<void> {
    return copyJson(
      wrapInMcpServers(streamableHttpConfig({ url, token })),
      "Streamable HTTP",
    );
  }

  /**
   * Persist the toggle and, when flipping to ON, run a one-shot
   * sync so the user immediately sees their config rewritten —
   * matching the mental model "I turned it on, it should be in sync now."
   * Disabling the toggle does not undo prior writes.
   */
  async function onToggleAutoWrite(
    event: Event & { currentTarget: HTMLInputElement },
  ): Promise<void> {
    if (busy) return;
    const desired = event.currentTarget.checked;
    busy = true;
    try {
      await setAutoWriteEnabled(plugin, desired);
      autoWrite = desired;
      if (desired) {
        const r = await applyAutoWrite(plugin);
        if (r.applied) {
          new Notice("Claude Desktop config rewritten.");
        } else if (r.applied === false && r.reason === "transport-offline") {
          new Notice(
            "Auto-write enabled, but the MCP transport is not running yet.",
          );
        } else if (r.applied === false && r.reason === "error") {
          new Notice(`Auto-write enabled, but write failed: ${r.error}`);
        }
      } else {
        new Notice("Auto-write disabled.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      new Notice(`Toggle failed: ${msg}`);
      // Revert the visual state to the persisted value.
      autoWrite = await getAutoWriteEnabled(plugin);
    } finally {
      busy = false;
    }
  }
</script>

<div class="mcp-client-config">
  <h3>Quick setup for clients</h3>

  <div class="setting-item">
    <div class="setting-item-info">
      <div class="setting-item-name">Copy config snippets</div>
      <div class="setting-item-description">
        Each button copies a ready-to-paste JSON block for the
        corresponding MCP client. Paste into the client's config file
        under <code>mcpServers</code>.
      </div>
    </div>
    <div class="setting-item-control copy-buttons">
      <button
        type="button"
        on:click={copyClaudeDesktop}
        disabled={!token || !port}
        aria-label="Copy Claude Desktop config"
      >
        Claude Desktop
      </button>
      <button
        type="button"
        on:click={copyClaudeCode}
        disabled={!token || !port}
        aria-label="Copy Claude Code config"
      >
        Claude Code
      </button>
      <button
        type="button"
        on:click={copyStreamableHttp}
        disabled={!token || !port}
        aria-label="Copy streamable-http config (Cursor, Cline, Continue, VS Code)"
      >
        Cursor / Cline / Continue
      </button>
    </div>
  </div>

  <div class="setting-item">
    <div class="setting-item-info">
      <div class="setting-item-name">Auto-write Claude Desktop config</div>
      <div class="setting-item-description">
        When enabled, the plugin rewrites
        <code>claude_desktop_config.json</code>
        whenever the bearer token rotates or the port changes. A
        backup is saved alongside the file as
        <code>.backup</code>. Off by default — turning it on touches
        a user-managed file outside the vault.
      </div>
    </div>
    <div class="setting-item-control">
      <input
        type="checkbox"
        checked={autoWrite}
        disabled={busy}
        on:change={onToggleAutoWrite}
        aria-label="Auto-write Claude Desktop config"
      />
    </div>
  </div>

  {#if !token || !port}
    <p class="hint">
      MCP transport is not running. Copy buttons are disabled until the
      HTTP server is up.
    </p>
  {/if}
</div>

<style>
  .mcp-client-config {
    margin-bottom: 1.5em;
  }

  .copy-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4em;
  }

  .hint {
    color: var(--text-muted);
    font-size: 0.85em;
    margin-top: 0.4em;
  }

  code {
    font-family: var(--font-monospace);
    font-size: 0.9em;
  }
</style>
