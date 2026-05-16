import { describe, expect, test, beforeEach } from "bun:test";
import {
  executeObsidianCommandHandler,
  executeObsidianCommandSchema,
} from "./executeObsidianCommand";
import {
  mockApp,
  mockPlugin,
  resetMockVault,
  setMockCommands,
  getExecutedCommands,
} from "$/test-setup";
import { _resetRateLimitForTests } from "$/features/mcp-tools/services/rateLimit";

beforeEach(() => {
  resetMockVault();
  _resetRateLimitForTests();
});

describe("execute_obsidian_command tool", () => {
  test("schema declares the tool name", () => {
    expect(executeObsidianCommandSchema.get("name")?.toString()).toContain(
      "execute_obsidian_command",
    );
  });

  test("denies command when permission disabled (default)", async () => {
    setMockCommands([{ id: "editor:fold", name: "Fold" }]);
    const plugin = mockPlugin({
      // Mock checkCommandPermission to always deny — simulates master
      // toggle off or command not in allowlist.
      checkCommandPermission: async (_id: string) => ({
        outcome: "deny" as const,
        reason: "disabled",
      }),
    } as never);

    const result = await executeObsidianCommandHandler({
      arguments: { commandId: "editor:fold" },
      app: mockApp(),
      plugin,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/denied|not allowed|disabled/i);
    expect(getExecutedCommands()).toEqual([]);
  });

  test("executes allowed command via app.commands.executeCommandById", async () => {
    setMockCommands([{ id: "editor:fold", name: "Fold" }]);
    const app = mockApp();
    const plugin = mockPlugin({
      app,
      checkCommandPermission: async (_id: string) => ({
        outcome: "allow" as const,
      }),
    } as never);

    const result = await executeObsidianCommandHandler({
      arguments: { commandId: "editor:fold" },
      app,
      plugin,
    });

    expect(result.isError).toBeUndefined();
    expect(getExecutedCommands()).toContain("editor:fold");
  });

  test("returns error for unknown command id", async () => {
    setMockCommands([]);
    const app = mockApp();
    const plugin = mockPlugin({
      app,
      checkCommandPermission: async (_id: string) => ({
        outcome: "allow" as const,
      }),
    } as never);

    const result = await executeObsidianCommandHandler({
      arguments: { commandId: "nonexistent" },
      app,
      plugin,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/not found|unknown/i);
  });

  test("respects rate limit (101st call within tumbling window fails)", async () => {
    setMockCommands([{ id: "x", name: "X" }]);
    const app = mockApp();
    const plugin = mockPlugin({
      app,
      checkCommandPermission: async () => ({ outcome: "allow" as const }),
    } as never);

    // 100 successful calls — should all pass.
    for (let i = 0; i < 100; i++) {
      const r = await executeObsidianCommandHandler({
        arguments: { commandId: "x" },
        app,
        plugin,
      });
      expect(r.isError).toBeUndefined();
    }

    // 101st call in the same tumbling window must be rate-limited.
    const r101 = await executeObsidianCommandHandler({
      arguments: { commandId: "x" },
      app,
      plugin,
    });
    expect(r101.isError).toBe(true);
    expect(r101.content[0].text).toMatch(/rate limit|too many/i);
  });
});
