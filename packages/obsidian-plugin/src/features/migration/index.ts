/**
 * Migration feature — detects and assists the upgrade from
 * 0.3.x (binary + Local REST API) to 0.4.0 (in-process HTTP).
 *
 * Public API surface today is just the detection layer (T1).
 * The plan and executor (T2), the new updateClaudeConfig shape
 * (T3), and the modal + first-load wiring (T7-T8) ride in
 * subsequent commits.
 */

export {
  detectLegacyInstall,
  hasAnyLegacySignal,
  legacyInstallStateSchema,
  type LegacyInstallState,
  type DetectLegacyInstallInput,
} from "./services/detect";

export {
  executeSteps,
  planMigration,
  type MigrationContext,
  type MigrationStep,
  type MigrationStepId,
  type MigrationStepResult,
  type MutatePluginData,
} from "./services/plan";

export {
  MigrationModalHost,
  type MigrationModalOptions,
} from "./services/migrationModalHost";

export { setupMigration } from "./services/setup";
