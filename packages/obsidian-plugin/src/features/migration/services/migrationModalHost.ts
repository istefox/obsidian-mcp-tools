/**
 * Obsidian Modal wrapper that hosts the MigrationModal Svelte body.
 *
 * Mirror of `commandPermissionModal.ts`'s pattern: the heavy lifting
 * (DOM mount/unmount lifecycle, Esc-to-close) lives in the Obsidian
 * Modal base class; we just bind the Svelte component to `contentEl`
 * and forward callbacks.
 *
 * The host carries no business logic of its own. Callers (T8 first-
 * load wiring) supply:
 *  - the detected `LegacyInstallState` (T1),
 *  - the planned `MigrationStep[]` (T2),
 *  - an `executeMigration(selectedIds)` function — production wires
 *    it through the plan executor; tests can stub it,
 *  - an `onSkip` hook that persists the "skipped" flag in
 *    `data.json`,
 *  - an `onLearnMore` hook that opens the upgrade docs URL,
 *  - an `onClose` hook called when the user dismisses after
 *    migration is done.
 */

import { Modal, type App } from "obsidian";
import { mount, unmount } from "svelte";
import MigrationModal from "../components/MigrationModal.svelte";
import type { LegacyInstallState } from "./detect";
import type { MigrationStep, MigrationStepId } from "./plan";

export type MigrationModalOptions = {
  state: LegacyInstallState;
  steps: MigrationStep[];
  executeMigration: (
    selectedIds: MigrationStepId[],
  ) => Promise<Array<{ id: MigrationStepId; ok: boolean; error?: string }>>;
  onSkip: () => void;
  onLearnMore: () => void;
  onClose: () => void;
};

export class MigrationModalHost extends Modal {
  private readonly opts: MigrationModalOptions;
  private component?: ReturnType<typeof mount>;
  private skippedOrClosed = false;

  constructor(app: App, opts: MigrationModalOptions) {
    super(app);
    this.opts = opts;
  }

  onOpen() {
    const wrappedSkip = () => {
      this.skippedOrClosed = true;
      this.opts.onSkip();
      this.close();
    };
    const wrappedClose = () => {
      this.skippedOrClosed = true;
      this.opts.onClose();
      this.close();
    };

    this.component = mount(MigrationModal, {
      target: this.contentEl,
      props: {
        state: this.opts.state,
        steps: this.opts.steps,
        executeMigration: this.opts.executeMigration,
        onSkip: wrappedSkip,
        onLearnMore: this.opts.onLearnMore,
        onClose: wrappedClose,
      },
    });
  }

  onClose() {
    if (this.component) {
      void unmount(this.component);
      this.component = undefined;
    }
    this.contentEl.empty();
    // If the modal was dismissed by Esc, X, or backdrop (i.e. not via
    // an in-Svelte action), treat it as "skip for now". Without this,
    // a user who Esc'd out would see the modal reappear on every
    // plugin load, which is annoying.
    if (!this.skippedOrClosed) {
      this.skippedOrClosed = true;
      this.opts.onSkip();
    }
  }
}
