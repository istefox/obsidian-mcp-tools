<script lang="ts">
  import { FeatureSettings as CommandPermissionsSettings } from "src/features/command-permissions";
  import { FeatureSettings as ToolToggleSettings } from "src/features/tool-toggle";
  import { FeatureSettings as SemanticSearchSettings } from "src/features/semantic-search";
  import { AccessControlSection } from "src/features/mcp-transport";
  import { ClientConfigSection } from "src/features/mcp-client-config";
  import type McpServerPlugin from "src/main";

  // 0.4.0 no longer ships an external `mcp-server` binary — the MCP
  // server runs in-process. The `mcp-server-install` settings section
  // (Install server, Local REST API required, Installation location,
  // Server install folder, …) was a 0.3.x install-flow surface and
  // is hidden from the 0.4.0 settings tab. The module itself stays in
  // the tree as a rollback safety net until 0.4.0 stable cuts; T14
  // retires it for good. See `docs/plans/0.4.0-phase-4-…` T12.b.

  export let plugin: McpServerPlugin;
</script>

<div class="settings-container">
  <AccessControlSection {plugin} />
  <ClientConfigSection {plugin} />
  <ToolToggleSettings {plugin} />
  <CommandPermissionsSettings {plugin} />
  <SemanticSearchSettings {plugin} />
</div>
