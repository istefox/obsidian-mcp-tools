<script lang="ts">
  import type McpToolsPlugin from "$/main";
  import { Notice } from "obsidian";
  import { onMount } from "svelte";
  import { applySettings } from "../index";
  import {
    DEFAULT_SEMANTIC_SETTINGS,
    type SemanticSearchSettings,
  } from "../types";
  import ModelDownloadProgress from "./ModelDownloadProgress.svelte";

  export let plugin: McpToolsPlugin;

  let settings: SemanticSearchSettings = { ...DEFAULT_SEMANTIC_SETTINGS };
  let saving = false;
  let rebuilding = false;
  let storeSize = 0;
  let lastError: string | null = null;

  onMount(() => {
    const state = plugin.semanticSearchState;
    if (state) {
      settings = { ...state.settings };
    }
    refreshStatus();
  });

  function refreshStatus() {
    // The store size is only available once the production wiring
    // (T15) constructs the store and exposes it on state.store. For
    // now we read it via an `any`-typed probe so the UI is forward-
    // compatible without forcing a type widening of state today.
    const state = plugin.semanticSearchState as
      | (typeof plugin.semanticSearchState & {
          store?: { size?: () => number };
        })
      | undefined;
    storeSize = state?.store?.size?.() ?? 0;
  }

  async function persist(next: SemanticSearchSettings) {
    const state = plugin.semanticSearchState;
    if (!state) {
      lastError = "Plugin not fully initialized — reload Obsidian.";
      return;
    }
    saving = true;
    lastError = null;
    try {
      await applySettings(plugin, state, next);
      settings = next;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    } finally {
      saving = false;
    }
  }

  async function onProviderChange(value: SemanticSearchSettings["provider"]) {
    await persist({ ...settings, provider: value });
  }

  async function onModeChange(value: SemanticSearchSettings["indexingMode"]) {
    await persist({ ...settings, indexingMode: value });
  }

  async function onUnloadChange(value: boolean) {
    await persist({ ...settings, unloadModelWhenIdle: value });
  }

  async function onRebuild() {
    const state = plugin.semanticSearchState as
      | (typeof plugin.semanticSearchState & {
          indexer?: { rebuildAll?: () => Promise<void> };
        })
      | undefined;
    const indexer = state?.indexer;
    if (!indexer?.rebuildAll) {
      new Notice("Indexer not available yet — wait for Phase 3 wiring.");
      return;
    }
    rebuilding = true;
    try {
      await indexer.rebuildAll();
      new Notice("Semantic index rebuilt.");
      refreshStatus();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      new Notice(`Rebuild failed: ${msg}`);
    } finally {
      rebuilding = false;
    }
  }
</script>

<div class="semantic-search-settings">
  <h3>Semantic search</h3>
  <p class="description">
    Search notes by meaning, not just by keyword. Pick the embedding
    backend that matches your setup.
  </p>

  <fieldset disabled={saving}>
    <legend>Provider</legend>
    <label>
      <input
        type="radio"
        name="ss-provider"
        value="auto"
        checked={settings.provider === "auto"}
        on:change={() => onProviderChange("auto")}
      />
      Auto
      <span class="hint"
        >use Smart Connections if installed, otherwise native</span
      >
    </label>
    <label>
      <input
        type="radio"
        name="ss-provider"
        value="native"
        checked={settings.provider === "native"}
        on:change={() => onProviderChange("native")}
      />
      Native
      <span class="hint"
        >Transformers.js + MiniLM-L6-v2, no external plugin required</span
      >
    </label>
    <label>
      <input
        type="radio"
        name="ss-provider"
        value="smart-connections"
        checked={settings.provider === "smart-connections"}
        on:change={() => onProviderChange("smart-connections")}
      />
      Smart Connections plugin
      <span class="hint">requires the Smart Connections community plugin</span>
    </label>
  </fieldset>

  {#if settings.provider !== "smart-connections"}
    <fieldset disabled={saving}>
      <legend>Indexing mode (native only)</legend>
      <label>
        <input
          type="radio"
          name="ss-mode"
          value="live"
          checked={settings.indexingMode === "live"}
          on:change={() => onModeChange("live")}
        />
        Live
        <span class="hint"
          >responsive, recommended — re-embed on file change</span
        >
      </label>
      <label>
        <input
          type="radio"
          name="ss-mode"
          value="low-power"
          checked={settings.indexingMode === "low-power"}
          on:change={() => onModeChange("low-power")}
        />
        Low-power
        <span class="hint">re-index every 5 min, saves battery</span>
      </label>
    </fieldset>

    <label class="checkbox">
      <input
        type="checkbox"
        checked={settings.unloadModelWhenIdle}
        on:change={(e) =>
          onUnloadChange((e.target as HTMLInputElement).checked)}
        disabled={saving}
      />
      Unload model when idle (60s)
      <span class="hint">frees ~150 MB of RAM after inactivity</span>
    </label>
  {/if}

  <ModelDownloadProgress {plugin} />

  <div class="status">
    <span>{storeSize.toLocaleString()} chunks indexed</span>
    <button
      type="button"
      on:click={onRebuild}
      disabled={rebuilding || saving}
    >
      {rebuilding ? "Rebuilding…" : "Rebuild index from scratch"}
    </button>
  </div>

  {#if lastError}
    <div class="error">{lastError}</div>
  {/if}
</div>

<style>
  .semantic-search-settings {
    margin-top: 2em;
  }

  .description {
    color: var(--text-muted);
    font-size: 0.9em;
    margin-bottom: 0.5em;
  }

  fieldset {
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    padding: 0.5em 1em;
    margin: 0 0 0.75em 0;
  }

  legend {
    font-weight: 600;
    font-size: 0.9em;
    padding: 0 0.4em;
  }

  fieldset label,
  label.checkbox {
    display: block;
    margin: 0.25em 0;
    cursor: pointer;
  }

  .hint {
    color: var(--text-muted);
    font-size: 0.85em;
    margin-left: 0.4em;
  }

  .status {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 1em;
    padding-top: 0.75em;
    border-top: 1px solid var(--background-modifier-border);
    font-size: 0.9em;
  }

  .error {
    color: var(--text-error);
    font-size: 0.9em;
    margin-top: 0.5em;
  }
</style>
