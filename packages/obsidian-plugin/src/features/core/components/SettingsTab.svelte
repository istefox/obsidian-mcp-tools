<script lang="ts">
  import { FeatureSettings as CommandPermissionsSettings } from "src/features/command-permissions";
  import { FeatureSettings as McpServerInstallSettings } from "src/features/mcp-server-install";
  import { FeatureSettings as ToolToggleSettings } from "src/features/tool-toggle";
  import { FeatureSettings as SemanticSearchSettings } from "src/features/semantic-search";
  import { AccessControlSection } from "src/features/mcp-transport";
  import type McpServerPlugin from "src/main";

  export let plugin: McpServerPlugin;
</script>

<div class="settings-container">
  <AccessControlSection {plugin} />
  <McpServerInstallSettings {plugin} />
  <ToolToggleSettings {plugin} />
  <CommandPermissionsSettings {plugin} />
  <SemanticSearchSettings {plugin} />
</div>
