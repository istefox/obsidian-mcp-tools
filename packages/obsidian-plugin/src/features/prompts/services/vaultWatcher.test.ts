import { describe, expect, test, beforeEach, mock } from "bun:test";
import { mockApp, resetMockVault, fireMockVaultEvent } from "$/test-setup";
import { createVaultWatcher } from "./vaultWatcher";

beforeEach(() => {
  resetMockVault();
});

function makeFile(path: string) {
  return { path } as { path: string };
}

describe("createVaultWatcher", () => {
  test("notifier called once on create event for Prompts/ md file", () => {
    const notifier = mock(() => {});
    const app = mockApp();
    createVaultWatcher(app, notifier);
    fireMockVaultEvent("create", makeFile("Prompts/foo.md"));
    expect(notifier).toHaveBeenCalledTimes(1);
  });

  test("notifier not called for Prompts/ non-md file", () => {
    const notifier = mock(() => {});
    const app = mockApp();
    createVaultWatcher(app, notifier);
    fireMockVaultEvent("create", makeFile("Prompts/foo.canvas"));
    expect(notifier).not.toHaveBeenCalled();
  });

  test("notifier not called for md file outside Prompts/", () => {
    const notifier = mock(() => {});
    const app = mockApp();
    createVaultWatcher(app, notifier);
    fireMockVaultEvent("create", makeFile("Notes/foo.md"));
    expect(notifier).not.toHaveBeenCalled();
  });

  test("notifier not called for md file in Prompts/ subdirectory", () => {
    const notifier = mock(() => {});
    const app = mockApp();
    createVaultWatcher(app, notifier);
    fireMockVaultEvent("create", makeFile("Prompts/sub/foo.md"));
    expect(notifier).not.toHaveBeenCalled();
  });

  test("notifier called on rename from Prompts/ to Archive/", () => {
    const notifier = mock(() => {});
    const app = mockApp();
    createVaultWatcher(app, notifier);
    fireMockVaultEvent("rename", makeFile("Archive/foo.md"), "Prompts/foo.md");
    expect(notifier).toHaveBeenCalledTimes(1);
  });

  test("notifier called on rename from Notes/ to Prompts/", () => {
    const notifier = mock(() => {});
    const app = mockApp();
    createVaultWatcher(app, notifier);
    fireMockVaultEvent("rename", makeFile("Prompts/foo.md"), "Notes/foo.md");
    expect(notifier).toHaveBeenCalledTimes(1);
  });

  test("notifier called on delete event for Prompts/ md file", () => {
    const notifier = mock(() => {});
    const app = mockApp();
    createVaultWatcher(app, notifier);
    fireMockVaultEvent("delete", makeFile("Prompts/bar.md"));
    expect(notifier).toHaveBeenCalledTimes(1);
  });

  test("stop() prevents subsequent events from calling notifier", () => {
    const notifier = mock(() => {});
    const app = mockApp();
    const watcher = createVaultWatcher(app, notifier);
    watcher.stop();
    fireMockVaultEvent("create", makeFile("Prompts/foo.md"));
    fireMockVaultEvent("delete", makeFile("Prompts/foo.md"));
    fireMockVaultEvent("rename", makeFile("Prompts/foo.md"), "Notes/foo.md");
    expect(notifier).not.toHaveBeenCalled();
  });
});
