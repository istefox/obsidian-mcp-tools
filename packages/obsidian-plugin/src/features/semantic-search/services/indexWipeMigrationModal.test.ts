import { beforeEach, describe, expect, test } from "bun:test";
import { mockApp } from "$/test-setup";
import { IndexWipeMigrationModal } from "./indexWipeMigrationModal";

/**
 * Unit tests for IndexWipeMigrationModal.
 *
 * The modal renders plain HTML via Obsidian's `contentEl.createEl` API
 * (no Svelte). The Modal stub in test-setup.ts provides a `contentEl`
 * that supports `createEl` and element-level `addEventListener`, so
 * tests can query the rendered button and simulate a click without a
 * real browser DOM.
 */

/** Retrieve all elements created on contentEl matching a given tag. */
function getCreatedEls(
  modal: IndexWipeMigrationModal,
  tag: string,
): Array<{ tag: string; text: string; listeners: Map<string, () => void> }> {
  const el = (
    modal as unknown as {
      contentEl: {
        _created: Array<{
          tag: string;
          text: string;
          listeners: Map<string, () => void>;
        }>;
      };
    }
  ).contentEl;
  return el._created.filter((e) => e.tag === tag);
}

describe("IndexWipeMigrationModal", () => {
  let app: ReturnType<typeof mockApp>;

  beforeEach(() => {
    app = mockApp();
  });

  test("onConfirm is NOT called immediately after onOpen", () => {
    let called = false;
    const modal = new IndexWipeMigrationModal({
      app,
      onConfirm: () => {
        called = true;
      },
    });

    modal.open(); // triggers onOpen()

    expect(called).toBe(false);
  });

  test("clicking the button calls onConfirm and closes the modal", () => {
    let confirmCount = 0;
    let closedByOnClose = false;
    const modal = new IndexWipeMigrationModal({
      app,
      onConfirm: () => {
        confirmCount++;
      },
    });

    // Patch onClose to detect it was called (the stub's close() calls onClose).
    const originalOnClose = modal.onClose.bind(modal);
    modal.onClose = () => {
      closedByOnClose = true;
      originalOnClose();
    };

    modal.open();

    // Simulate button click via the click listener registered on contentEl
    const buttons = getCreatedEls(modal, "button");
    expect(buttons).toHaveLength(1);
    const clickHandler = buttons[0]!.listeners.get("click");
    expect(typeof clickHandler).toBe("function");

    clickHandler!();

    expect(confirmCount).toBe(1);
    expect(closedByOnClose).toBe(true);
  });

  test("close() is invoked after button click", () => {
    let closedByOnClose = false;
    const modal = new IndexWipeMigrationModal({
      app,
      onConfirm: () => {},
    });

    // Patch onClose to detect it was called (the stub's close() calls onClose).
    const originalOnClose = modal.onClose.bind(modal);
    modal.onClose = () => {
      closedByOnClose = true;
      originalOnClose();
    };

    modal.open();

    const buttons = getCreatedEls(modal, "button");
    const clickHandler = buttons[0]!.listeners.get("click");
    clickHandler!();

    expect(closedByOnClose).toBe(true);
  });

  test("onClose empties contentEl", () => {
    let emptied = false;
    const modal = new IndexWipeMigrationModal({ app, onConfirm: () => {} });
    (modal as unknown as { contentEl: { empty: () => void } }).contentEl.empty =
      () => {
        emptied = true;
      };

    modal.open();
    modal.close();

    expect(emptied).toBe(true);
  });

  test("dismissing the modal (calling onClose without button click) calls onCancel", () => {
    let cancelCount = 0;
    let confirmCount = 0;
    const modal = new IndexWipeMigrationModal({
      app,
      onConfirm: () => {
        confirmCount++;
      },
      onCancel: () => {
        cancelCount++;
      },
    });

    modal.open();
    // Simulate Escape / overlay close: close() without a button click.
    modal.close();

    expect(cancelCount).toBe(1);
    expect(confirmCount).toBe(0);
  });

  test("confirming the modal does NOT call onCancel", () => {
    let cancelCount = 0;
    const modal = new IndexWipeMigrationModal({
      app,
      onConfirm: () => {},
      onCancel: () => {
        cancelCount++;
      },
    });

    modal.open();

    const buttons = getCreatedEls(modal, "button");
    const clickHandler = buttons[0]!.listeners.get("click");
    clickHandler!();

    expect(cancelCount).toBe(0);
  });

  test("double-clicking the button calls onConfirm only once", () => {
    let confirmCount = 0;
    const modal = new IndexWipeMigrationModal({
      app,
      onConfirm: () => {
        confirmCount++;
      },
    });

    modal.open();

    const buttons = getCreatedEls(modal, "button");
    const clickHandler = buttons[0]!.listeners.get("click");
    expect(typeof clickHandler).toBe("function");

    // Simulate rapid double-click — the _confirmed guard must prevent
    // onConfirm from being called more than once.
    clickHandler!();
    clickHandler!();

    expect(confirmCount).toBe(1);
  });
});
