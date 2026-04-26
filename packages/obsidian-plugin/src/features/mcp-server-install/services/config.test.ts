import {
  afterEach,
  beforeEach,
  describe,
  expect,
  spyOn,
  test,
  type Mock,
} from "bun:test";
import fsp from "fs/promises";
import os from "os";
import path from "path";
import { removeFromClaudeConfig, updateClaudeConfig } from "./config";

/**
 * End-to-end tests for the Claude Desktop config writer. Strategy:
 *
 * - Create a real temp directory per test as the fake HOME.
 * - Stub `os.homedir()` via `spyOn` so `getConfigPath()`'s tilde
 *   expansion lands inside the sandbox. We cannot rely on setting
 *   `process.env.HOME` — Bun/Node read the effective UID once and
 *   do not re-resolve it on env changes at runtime.
 * - The `plugin` parameter of updateClaudeConfig is `unknown` and
 *   unused in the function body; we pass `null` to make it explicit.
 *
 * Platform scope: these tests run only on macOS because
 * `getConfigPath()` branches on `os.platform()` at call time. The
 * macOS branch is what this project's primary users hit. The Linux
 * branch is separately guarded by `CLAUDE_CONFIG_PATH.linux` in
 * `constants.test.ts`. Windows (`%APPDATA%`) is not covered here.
 */

describe("updateClaudeConfig", () => {
  if (os.platform() !== "darwin") {
    test.skip("updateClaudeConfig tests run only on macOS", () => {});
    return;
  }

  let tmpRoot: string;
  let configPath: string;
  let homedirSpy: Mock<typeof os.homedir>;

  beforeEach(async () => {
    tmpRoot = await fsp.mkdtemp(
      path.join(os.tmpdir(), "mcp-tools-config-test-"),
    );
    homedirSpy = spyOn(os, "homedir").mockReturnValue(tmpRoot);
    configPath = path.join(
      tmpRoot,
      "Library/Application Support/Claude/claude_desktop_config.json",
    );
  });

  afterEach(async () => {
    homedirSpy.mockRestore();
    await fsp.rm(tmpRoot, { recursive: true, force: true });
  });

  test("creates the config file and its parent directory when missing", async () => {
    // Sanity check: neither the file nor its Claude directory exist
    // before the call. The writer must recursively mkdir.
    await expect(fsp.access(configPath)).rejects.toThrow();

    await updateClaudeConfig(
      null,
      "/abs/path/to/mcp-server",
      "test-api-key",
    );

    const content = JSON.parse(await fsp.readFile(configPath, "utf8"));
    expect(content).toEqual({
      mcpServers: {
        "obsidian-mcp-tools": {
          command: "/abs/path/to/mcp-server",
          env: {
            OBSIDIAN_API_KEY: "test-api-key",
          },
        },
      },
    });
  });

  test("preserves unrelated MCP server entries already in the config", async () => {
    // A user may have configured other MCP servers before installing
    // this plugin. The writer must not clobber them — only our own
    // `obsidian-mcp-tools` entry is ours to rewrite.
    await fsp.mkdir(path.dirname(configPath), { recursive: true });
    await fsp.writeFile(
      configPath,
      JSON.stringify({
        mcpServers: {
          "some-other-server": {
            command: "/usr/bin/other-mcp",
            env: { FOO: "bar" },
          },
        },
        unrelatedTopLevelKey: "preserve me",
      }),
    );

    await updateClaudeConfig(
      null,
      "/abs/path/to/mcp-server",
      "test-api-key",
    );

    const content = JSON.parse(await fsp.readFile(configPath, "utf8"));
    expect(content.mcpServers["some-other-server"]).toEqual({
      command: "/usr/bin/other-mcp",
      env: { FOO: "bar" },
    });
    expect(content.mcpServers["obsidian-mcp-tools"].command).toBe(
      "/abs/path/to/mcp-server",
    );
    // Non-mcpServers top-level keys should also survive the rewrite.
    // Note: today's implementation parses and re-serializes the full
    // config, so unrelated top-level keys ride along for free — this
    // test pins that behavior so a future refactor cannot silently
    // drop user data.
    expect(content.unrelatedTopLevelKey).toBe("preserve me");
  });

  test("merges extraEnv into the env block alongside OBSIDIAN_API_KEY", async () => {
    await updateClaudeConfig(
      null,
      "/abs/path/to/mcp-server",
      "test-api-key",
      {
        OBSIDIAN_DISABLED_TOOLS: "patch_vault_file, delete_vault_file",
        OBSIDIAN_HOST: "192.168.1.50",
      },
    );

    const content = JSON.parse(await fsp.readFile(configPath, "utf8"));
    expect(content.mcpServers["obsidian-mcp-tools"].env).toEqual({
      OBSIDIAN_API_KEY: "test-api-key",
      OBSIDIAN_DISABLED_TOOLS: "patch_vault_file, delete_vault_file",
      OBSIDIAN_HOST: "192.168.1.50",
    });
  });

  test("omits OBSIDIAN_DISABLED_TOOLS when extraEnv is undefined", async () => {
    // This is the default-install path: no disabled list configured,
    // so only OBSIDIAN_API_KEY is written. The env block must not
    // contain leftover keys from a previous undefined/empty state.
    await updateClaudeConfig(
      null,
      "/abs/path/to/mcp-server",
      "test-api-key",
    );

    const content = JSON.parse(await fsp.readFile(configPath, "utf8"));
    const env = content.mcpServers["obsidian-mcp-tools"].env;
    expect(env).toEqual({ OBSIDIAN_API_KEY: "test-api-key" });
    expect("OBSIDIAN_DISABLED_TOOLS" in env).toBe(false);
  });

  test("overwrites the previous obsidian-mcp-tools entry on repeat install", async () => {
    // Simulate a reinstall where the old entry has stale env values
    // that should be fully replaced, not merged onto.
    await fsp.mkdir(path.dirname(configPath), { recursive: true });
    await fsp.writeFile(
      configPath,
      JSON.stringify({
        mcpServers: {
          "obsidian-mcp-tools": {
            command: "/old/path/to/mcp-server",
            env: {
              OBSIDIAN_API_KEY: "old-key",
              OBSIDIAN_DISABLED_TOOLS: "stale_tool",
            },
          },
        },
      }),
    );

    await updateClaudeConfig(
      null,
      "/new/path/to/mcp-server",
      "new-key",
    );

    const content = JSON.parse(await fsp.readFile(configPath, "utf8"));
    const entry = content.mcpServers["obsidian-mcp-tools"];
    expect(entry.command).toBe("/new/path/to/mcp-server");
    // The stale OBSIDIAN_DISABLED_TOOLS must be gone — not carried
    // over from the previous install.
    expect(entry.env).toEqual({ OBSIDIAN_API_KEY: "new-key" });
  });

  test("writes valid JSON that round-trips through JSON.parse", async () => {
    // Defense in depth: guarantee the output is not just human-
    // readable but parseable — catches accidental JSON.stringify
    // replacer misuse or encoding drift.
    await updateClaudeConfig(
      null,
      "/abs/path/to/mcp-server",
      "test-api-key",
      { OBSIDIAN_DISABLED_TOOLS: "a, b" },
    );

    const raw = await fsp.readFile(configPath, "utf8");
    expect(() => JSON.parse(raw)).not.toThrow();
    // The file is pretty-printed with 2-space indent per the
    // implementation's `JSON.stringify(..., null, 2)` call — spot-
    // check by looking for a newline in the output.
    expect(raw).toContain("\n");
  });
});

describe("removeFromClaudeConfig", () => {
  if (os.platform() !== "darwin") {
    test.skip("removeFromClaudeConfig tests run only on macOS", () => {});
    return;
  }

  let tmpRoot: string;
  let configPath: string;
  let homedirSpy: Mock<typeof os.homedir>;

  beforeEach(async () => {
    tmpRoot = await fsp.mkdtemp(
      path.join(os.tmpdir(), "mcp-tools-config-remove-test-"),
    );
    homedirSpy = spyOn(os, "homedir").mockReturnValue(tmpRoot);
    configPath = path.join(
      tmpRoot,
      "Library/Application Support/Claude/claude_desktop_config.json",
    );
  });

  afterEach(async () => {
    homedirSpy.mockRestore();
    await fsp.rm(tmpRoot, { recursive: true, force: true });
  });

  test("removes the obsidian-mcp-tools entry and keeps others intact", async () => {
    await fsp.mkdir(path.dirname(configPath), { recursive: true });
    await fsp.writeFile(
      configPath,
      JSON.stringify({
        mcpServers: {
          "obsidian-mcp-tools": {
            command: "/old/path",
            env: { OBSIDIAN_API_KEY: "key" },
          },
          "some-other-server": {
            command: "/usr/bin/other",
          },
        },
      }),
    );

    await removeFromClaudeConfig();

    const content = JSON.parse(await fsp.readFile(configPath, "utf8"));
    expect("obsidian-mcp-tools" in content.mcpServers).toBe(false);
    expect(content.mcpServers["some-other-server"]).toEqual({
      command: "/usr/bin/other",
    });
  });

  test("is a no-op when the config file does not exist", async () => {
    // A user who never ran "Install Server" uninstalls the plugin —
    // there is nothing to remove. The call must not throw.
    await expect(removeFromClaudeConfig()).resolves.toBeUndefined();
  });

  test("is a no-op when our entry is absent from an otherwise valid config", async () => {
    await fsp.mkdir(path.dirname(configPath), { recursive: true });
    const originalContent = {
      mcpServers: {
        "some-other-server": { command: "/usr/bin/other" },
      },
    };
    await fsp.writeFile(configPath, JSON.stringify(originalContent));

    await removeFromClaudeConfig();

    // The file should still exist with the same unrelated entry.
    const content = JSON.parse(await fsp.readFile(configPath, "utf8"));
    expect(content).toEqual(originalContent);
  });
});

describe("updateClaudeConfig — issue #11 investigation (folotp toggle scenario + edge cases)", () => {
  if (os.platform() !== "darwin") {
    test.skip("issue #11 investigation tests run only on macOS", () => {});
    return;
  }

  let tmpRoot: string;
  let configPath: string;
  let homedirSpy: Mock<typeof os.homedir>;

  const SYS = "/Users/folotp/Library/Application Support/obsidian-mcp-tools/bin/mcp-server";
  const VAULT = "/Users/folotp/Obsidian/vault/.obsidian/plugins/mcp-tools-istefox/bin/mcp-server";
  const KEY = "test-api-key-64-hex-chars";

  beforeEach(async () => {
    tmpRoot = await fsp.mkdtemp(
      path.join(os.tmpdir(), "mcp-tools-issue11-test-"),
    );
    homedirSpy = spyOn(os, "homedir").mockReturnValue(tmpRoot);
    configPath = path.join(
      tmpRoot,
      "Library/Application Support/Claude/claude_desktop_config.json",
    );
  });

  afterEach(async () => {
    homedirSpy.mockRestore();
    await fsp.rm(tmpRoot, { recursive: true, force: true });
  });

  test("folotp's exact toggle sequence: outside → vault → outside leaves the entry intact", async () => {
    // The bug @folotp reported on the fork at #11 says: under
    // "Outside vault" location, Install Server downloads the binary
    // but the config is rewritten with `mcpServers: {}`. Toggling to
    // "Inside vault" and re-installing fixes it; toggling back loses
    // it again. handleInstallLocationChange does NOT call
    // updateClaudeConfig — only the Install button does. So the
    // observable sequence in the config writer is: write SYS, write
    // VAULT, write SYS. This test pins that the writer never produces
    // the empty `mcpServers: {}` shape across that sequence.

    // Step 1: Install while location=outside-vault.
    await updateClaudeConfig(null, SYS, KEY);
    let content = JSON.parse(await fsp.readFile(configPath, "utf8"));
    expect(content.mcpServers["obsidian-mcp-tools"]?.command).toBe(SYS);

    // Step 2 (no-op in the writer): toggle to vault.

    // Step 3: Install while location=vault.
    await updateClaudeConfig(null, VAULT, KEY);
    content = JSON.parse(await fsp.readFile(configPath, "utf8"));
    expect(content.mcpServers["obsidian-mcp-tools"]?.command).toBe(VAULT);

    // Step 4 (no-op): toggle back to outside-vault.

    // Step 5: Install while location=outside-vault.
    await updateClaudeConfig(null, SYS, KEY);
    content = JSON.parse(await fsp.readFile(configPath, "utf8"));
    // The bug would be: mcpServers === {} or entry missing.
    expect(content.mcpServers["obsidian-mcp-tools"]?.command).toBe(SYS);
    expect(Object.keys(content.mcpServers)).toContain("obsidian-mcp-tools");
  });

  test("serverPath as empty string still writes an entry (does NOT produce `mcpServers: {}`)", async () => {
    // Defensive: even with a falsy serverPath, the writer assigns the
    // entry. JSON.stringify omits undefined values inside the entry but
    // keeps the entry key itself. This test pins that the writer never
    // collapses to empty `mcpServers` regardless of serverPath shape.
    await updateClaudeConfig(null, "", KEY);
    const content = JSON.parse(await fsp.readFile(configPath, "utf8"));
    expect("obsidian-mcp-tools" in content.mcpServers).toBe(true);
    expect(content.mcpServers["obsidian-mcp-tools"].command).toBe("");
    // mcpServers is NOT empty — the bug shape would be { mcpServers: {} }
    expect(Object.keys(content.mcpServers).length).toBe(1);
  });

  test("serverPath as undefined still writes an entry (env survives, command omitted by JSON.stringify)", async () => {
    // Probes the exact shape: undefined as serverPath via type cast
    // (mimicking a buggy caller).
    await updateClaudeConfig(null, undefined as unknown as string, KEY);
    const content = JSON.parse(await fsp.readFile(configPath, "utf8"));
    expect("obsidian-mcp-tools" in content.mcpServers).toBe(true);
    // command is undefined → JSON.stringify omits the key, but the
    // entry object survives because env is still there.
    expect("command" in content.mcpServers["obsidian-mcp-tools"]).toBe(false);
    expect(content.mcpServers["obsidian-mcp-tools"].env).toEqual({
      OBSIDIAN_API_KEY: KEY,
    });
    // Entry NOT empty.
    expect(Object.keys(content.mcpServers).length).toBe(1);
  });

  test("malformed existing JSON throws — the writer does NOT silently overwrite to `mcpServers: {}`", async () => {
    // Pre-existing config that fails JSON.parse: the writer must
    // throw, not swallow + overwrite with a fresh empty config.
    // Folotp's "rewritten with empty mcpServers" symptom would
    // manifest here if the writer caught SyntaxError silently.
    await fsp.mkdir(path.dirname(configPath), { recursive: true });
    const corrupt = "{ mcpServers: { invalid json no quotes";
    await fsp.writeFile(configPath, corrupt);

    await expect(
      updateClaudeConfig(null, SYS, KEY),
    ).rejects.toThrow(/Failed to update Claude config/);

    // Confirm the writer did NOT replace the corrupt content.
    const after = await fsp.readFile(configPath, "utf8");
    expect(after).toBe(corrupt);
  });

  test("empty existing file throws (JSON.parse('') is a SyntaxError) — the writer does NOT overwrite", async () => {
    // Same defensive guarantee for the special case of a zero-byte
    // file. Some users hit this when an editor or sync tool truncates
    // the config mid-write and leaves a 0-byte stub.
    await fsp.mkdir(path.dirname(configPath), { recursive: true });
    await fsp.writeFile(configPath, "");

    await expect(
      updateClaudeConfig(null, SYS, KEY),
    ).rejects.toThrow(/Failed to update Claude config/);

    const after = await fsp.readFile(configPath, "utf8");
    expect(after).toBe("");
  });

  test("existing config with `mcpServers: {}` is written CORRECTLY with the entry on a fresh install", async () => {
    // The control test: if a user's config legitimately has empty
    // `mcpServers: {}` (e.g. they removed all entries manually), the
    // first Install Server call must populate it correctly. If folotp
    // saw `mcpServers: {}` AFTER clicking Install, this test path
    // proves the writer does not produce that shape on this input.
    await fsp.mkdir(path.dirname(configPath), { recursive: true });
    await fsp.writeFile(configPath, JSON.stringify({ mcpServers: {} }));

    await updateClaudeConfig(null, SYS, KEY);
    const content = JSON.parse(await fsp.readFile(configPath, "utf8"));
    expect(content.mcpServers["obsidian-mcp-tools"]?.command).toBe(SYS);
  });

  test("BOM-prefixed JSON file is rejected (writer does not silently strip and overwrite)", async () => {
    // Some Windows editors prepend U+FEFF to JSON files. JSON.parse
    // chokes on it. The writer must throw, not silently overwrite the
    // BOM file with a fresh `mcpServers: {}` config.
    await fsp.mkdir(path.dirname(configPath), { recursive: true });
    const bomContent =
      "﻿" + JSON.stringify({ mcpServers: { existing: { command: "/x" } } });
    await fsp.writeFile(configPath, bomContent);

    await expect(
      updateClaudeConfig(null, SYS, KEY),
    ).rejects.toThrow(/Failed to update Claude config/);
    // The BOM-prefixed file is preserved on throw — not clobbered.
    const after = await fsp.readFile(configPath, "utf8");
    expect(after).toBe(bomContent);
  });

  test("missing top-level `mcpServers` key (config has only unrelated keys) gets `mcpServers` recreated and entry added", async () => {
    // The `config.mcpServers = config.mcpServers || {}` guard at line
    // 96 of config.ts kicks in here. Defensive against an existing
    // config that someone edited to remove the mcpServers section
    // entirely.
    await fsp.mkdir(path.dirname(configPath), { recursive: true });
    await fsp.writeFile(
      configPath,
      JSON.stringify({ unrelatedTopLevelKey: "preserve me" }),
    );

    await updateClaudeConfig(null, SYS, KEY);
    const content = JSON.parse(await fsp.readFile(configPath, "utf8"));
    expect(content.mcpServers["obsidian-mcp-tools"]?.command).toBe(SYS);
    expect(content.unrelatedTopLevelKey).toBe("preserve me");
  });
});
