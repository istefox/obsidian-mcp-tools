<script lang="ts">
  import type {
    LegacyInstallState,
    MigrationStep,
    MigrationStepId,
  } from "../services/plan";

  /**
   * Migration modal body. Hosted by `MigrationModalHost` (Obsidian
   * Modal wrapper) which provides the `<dialog>` chrome and lifecycle.
   *
   * Three buttons:
   *  - **Migrate** — runs `executeSteps(selected)` in place; results
   *    are shown inline next to each checkbox so the user does not
   *    have to dismiss + re-open to see what happened.
   *  - **Skip for now** — caller persists a "skipped" flag so the
   *    modal does not re-open every plugin load.
   *  - **Learn more** — opens the upgrade docs in the default browser.
   *
   * Accessibility: all interactive controls are real buttons /
   * checkboxes (no div-as-button), labels reference the input via
   * `for`, the close button is auto-focused after a successful
   * migration so keyboard users can dismiss with Enter.
   */

  export let state: LegacyInstallState;
  export let steps: MigrationStep[];
  export let executeMigration: (
    selectedIds: MigrationStepId[],
  ) => Promise<Array<{ id: MigrationStepId; ok: boolean; error?: string }>>;
  export let onSkip: () => void;
  export let onLearnMore: () => void;
  export let onClose: () => void;

  // Pre-check every step that is `defaultEnabled`. A user can untick
  // any of them before clicking Migrate.
  let selected: Record<MigrationStepId, boolean> = steps.reduce(
    (acc, s) => {
      acc[s.id] = s.defaultEnabled;
      return acc;
    },
    {} as Record<MigrationStepId, boolean>,
  );

  type Phase = "ready" | "running" | "done";
  let phase: Phase = "ready";
  let results: Array<{ id: MigrationStepId; ok: boolean; error?: string }> = [];

  $: selectedIds = (
    Object.entries(selected) as [MigrationStepId, boolean][]
  )
    .filter(([, on]) => on)
    .map(([id]) => id);

  $: anySelected = selectedIds.length > 0;

  function resultFor(id: MigrationStepId) {
    return results.find((r) => r.id === id);
  }

  async function handleMigrate() {
    if (phase === "running") return;
    phase = "running";
    results = await executeMigration(selectedIds);
    phase = "done";
  }
</script>

<div class="mcp-migration-modal">
  <h2>Welcome to MCP Connector 0.4.0</h2>

  <p class="lead">
    The plugin moved to a new architecture: no more external binary,
    no more Local REST API dependency. The MCP server now runs
    in-process inside Obsidian over HTTP.
  </p>

  <p class="lead">
    We detected leftover state from your previous (0.3.x) install. You
    can clean it up automatically with the steps below — every step is
    optional.
  </p>

  {#if state.hasLegacyClaudeConfigEntry && state.legacyClaudeConfigPath}
    <p class="path-hint">
      Claude Desktop config:
      <code>{state.legacyClaudeConfigPath}</code>
    </p>
  {/if}

  <ul class="steps">
    {#each steps as step (step.id)}
      <li class="step">
        <label class="step-row">
          <input
            type="checkbox"
            bind:checked={selected[step.id]}
            disabled={phase !== "ready"}
            aria-describedby="desc-{step.id}"
          />
          <span class="step-title">{step.title}</span>
        </label>
        <p class="step-description" id="desc-{step.id}">
          {step.description}
        </p>
        {#if phase === "done"}
          {@const r = resultFor(step.id)}
          {#if r === undefined && !selected[step.id]}
            <p class="step-result skipped">Skipped.</p>
          {:else if r?.ok}
            <p class="step-result ok">Done.</p>
          {:else if r}
            <p class="step-result fail">Failed: {r.error ?? "unknown error"}</p>
          {/if}
        {/if}
      </li>
    {/each}
  </ul>

  <p class="lra-hint">
    The 0.4.0 plugin no longer depends on the
    <strong>Local REST API</strong>
    plugin. If no other plugin uses it, you can disable it from
    Obsidian's community plugins settings — we leave that decision to
    you.
  </p>

  <div class="actions">
    {#if phase === "ready"}
      <button
        type="button"
        class="primary"
        on:click={handleMigrate}
        disabled={!anySelected}
      >
        Migrate
      </button>
      <button type="button" on:click={onSkip}>Skip for now</button>
      <button type="button" on:click={onLearnMore}>Learn more</button>
    {:else if phase === "running"}
      <button type="button" class="primary" disabled>Migrating…</button>
    {:else}
      <button
        type="button"
        class="primary"
        on:click={onClose}
        autofocus
      >
        Close
      </button>
    {/if}
  </div>
</div>

<style>
  .mcp-migration-modal {
    max-width: 36em;
    line-height: 1.5;
  }

  .mcp-migration-modal h2 {
    margin-top: 0;
  }

  .lead {
    color: var(--text-normal);
  }

  .path-hint {
    margin: 0.5em 0 1em;
    font-size: 0.85em;
    color: var(--text-muted);
  }

  .steps {
    list-style: none;
    padding: 0;
    margin: 1em 0;
  }

  .step + .step {
    margin-top: 0.8em;
  }

  .step-row {
    display: flex;
    align-items: center;
    gap: 0.5em;
    cursor: pointer;
  }

  .step-title {
    font-weight: 600;
  }

  .step-description {
    margin: 0.25em 0 0 1.5em;
    font-size: 0.9em;
    color: var(--text-muted);
  }

  .step-result {
    margin: 0.25em 0 0 1.5em;
    font-size: 0.9em;
    font-weight: 600;
  }

  .step-result.ok {
    color: var(--text-success);
  }

  .step-result.fail {
    color: var(--text-error);
  }

  .step-result.skipped {
    color: var(--text-muted);
    font-weight: 400;
  }

  .lra-hint {
    margin: 1em 0;
    padding: 0.6em 0.8em;
    border-left: 3px solid var(--background-modifier-border);
    background: var(--background-secondary);
    font-size: 0.9em;
  }

  .actions {
    display: flex;
    gap: 0.5em;
    flex-wrap: wrap;
    margin-top: 1.2em;
  }

  .actions button.primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  code {
    font-family: var(--font-monospace);
    font-size: 0.9em;
  }
</style>
