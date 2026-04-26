import { afterEach, describe, expect, test } from "bun:test";
import {
  clearNodeDetectCache,
  detectNode,
  type ExecRunner,
} from "./nodeDetect";

/**
 * Tests for the Node.js detector. We inject a stubbed `runner` so the
 * tests do not depend on the host having Node on PATH and so we can
 * exercise the parsing / error-classification branches deterministically.
 *
 * The real production runner is `promisify(child_process.exec)`. The
 * `status.integration.test.ts` pattern (real shell scripts in tmpdir)
 * is overkill here — we only ever invoke `node --version`, which has
 * a stable contract we can fake at the runner level.
 */

afterEach(() => {
  clearNodeDetectCache();
});

describe("detectNode — parsing", () => {
  test("parses standard `vX.Y.Z\\n` output", async () => {
    const runner: ExecRunner = async () => ({
      stdout: "v22.3.0\n",
      stderr: "",
    });
    const r = await detectNode({ runner, forceRefresh: true });
    expect(r).toEqual({ found: true, version: "22.3.0", raw: "v22.3.0\n" });
  });

  test("parses pre-release suffix (nightly / rc)", async () => {
    const runner: ExecRunner = async () => ({
      stdout: "v22.0.0-nightly20240501",
      stderr: "",
    });
    const r = await detectNode({ runner, forceRefresh: true });
    expect(r.found).toBe(true);
    expect(r.found && r.version).toBe("22.0.0-nightly20240501");
  });

  test("rejects unrecognized output (fails closed)", async () => {
    const runner: ExecRunner = async () => ({
      stdout: "node v22 (custom build)\n",
      stderr: "",
    });
    const r = await detectNode({ runner, forceRefresh: true });
    expect(r.found).toBe(false);
    expect(r.found === false && r.error).toContain("Unrecognized");
  });
});

describe("detectNode — error classification", () => {
  test("ENOENT-style error → friendly hint", async () => {
    const runner: ExecRunner = async () => {
      throw new Error("spawn node ENOENT");
    };
    const r = await detectNode({ runner, forceRefresh: true });
    expect(r).toEqual({
      found: false,
      error: "Node.js not found on PATH. Install from nodejs.org.",
    });
  });

  test("Windows `not recognized` error → friendly hint", async () => {
    const runner: ExecRunner = async () => {
      throw new Error("'node' is not recognized as an internal or external command");
    };
    const r = await detectNode({ runner, forceRefresh: true });
    expect(r.found).toBe(false);
    expect(r.found === false && r.error).toContain("Node.js not found on PATH");
  });

  test("non-ENOENT error surfaces the raw message (debug-friendly)", async () => {
    const runner: ExecRunner = async () => {
      throw new Error("EACCES: permission denied");
    };
    const r = await detectNode({ runner, forceRefresh: true });
    expect(r.found).toBe(false);
    expect(r.found === false && r.error).toContain("EACCES");
  });
});

describe("detectNode — caching", () => {
  test("second call returns the cached result without invoking the runner", async () => {
    let invocations = 0;
    const runner: ExecRunner = async () => {
      invocations++;
      return { stdout: "v22.3.0\n", stderr: "" };
    };

    await detectNode({ runner, forceRefresh: true });
    expect(invocations).toBe(1);

    await detectNode({ runner });
    expect(invocations).toBe(1); // still 1 — cache hit
  });

  test("forceRefresh bypasses the cache", async () => {
    let invocations = 0;
    const runner: ExecRunner = async () => {
      invocations++;
      return { stdout: "v22.3.0\n", stderr: "" };
    };

    await detectNode({ runner, forceRefresh: true });
    await detectNode({ runner, forceRefresh: true });
    expect(invocations).toBe(2);
  });

  test("clearNodeDetectCache forces the next call to spawn", async () => {
    let invocations = 0;
    const runner: ExecRunner = async () => {
      invocations++;
      return { stdout: "v22.3.0\n", stderr: "" };
    };

    await detectNode({ runner, forceRefresh: true });
    clearNodeDetectCache();
    await detectNode({ runner });
    expect(invocations).toBe(2);
  });

  test("cache survives a not-found result so the UI does not repeatedly spawn", async () => {
    let invocations = 0;
    const runner: ExecRunner = async () => {
      invocations++;
      throw new Error("spawn node ENOENT");
    };

    const first = await detectNode({ runner, forceRefresh: true });
    expect(first.found).toBe(false);

    const second = await detectNode({ runner });
    expect(second.found).toBe(false);
    expect(invocations).toBe(1);
  });
});
