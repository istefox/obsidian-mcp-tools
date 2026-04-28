import { describe, expect, test } from "bun:test";
import {
  normalizePath,
  parseApiUrl,
  parsePort,
  resolveHostOverride,
  resolvePortFromArgs,
} from "./makeRequest";

describe("parsePort", () => {
  test("parses a valid port string", () => {
    expect(parsePort("9000")).toBe(9000);
  });

  test("parses the lowest valid port", () => {
    expect(parsePort("1")).toBe(1);
  });

  test("parses the highest valid port", () => {
    expect(parsePort("65535")).toBe(65535);
  });

  test("rejects port zero", () => {
    expect(parsePort("0")).toBeUndefined();
  });

  test("rejects ports above the TCP range", () => {
    expect(parsePort("65536")).toBeUndefined();
  });

  test("rejects non-numeric input", () => {
    expect(parsePort("abc")).toBeUndefined();
  });

  test("rejects mixed alphanumeric input", () => {
    expect(parsePort("9000abc")).toBeUndefined();
  });

  test("rejects negative numbers", () => {
    // The regex ^\d+$ excludes the minus sign, so negatives never reach
    // the numeric range check.
    expect(parsePort("-1")).toBeUndefined();
  });

  test("rejects empty string", () => {
    expect(parsePort("")).toBeUndefined();
  });

  test("rejects undefined", () => {
    expect(parsePort(undefined)).toBeUndefined();
  });

  test("rejects whitespace-only input", () => {
    expect(parsePort("  ")).toBeUndefined();
  });
});

describe("resolvePortFromArgs", () => {
  // Minimal argv prefix that mirrors what Bun/Node pass in production.
  // resolvePortFromArgs ignores argv[0] and argv[1] naturally because
  // neither match `--port` patterns, so we do not need to splice them.
  const prefix = ["/usr/local/bin/bun", "/path/to/index.ts"];

  test("returns undefined for empty argv", () => {
    expect(resolvePortFromArgs([])).toBeUndefined();
  });

  test("returns undefined when argv has no port flag", () => {
    expect(resolvePortFromArgs([...prefix, "--verbose"])).toBeUndefined();
  });

  test("parses --port with a separate value argument", () => {
    expect(resolvePortFromArgs([...prefix, "--port", "9000"])).toBe(9000);
  });

  test("parses --port=value equals form", () => {
    expect(resolvePortFromArgs([...prefix, "--port=9000"])).toBe(9000);
  });

  test("returns undefined when --port value is missing", () => {
    expect(resolvePortFromArgs([...prefix, "--port"])).toBeUndefined();
  });

  test("returns undefined when --port value is invalid", () => {
    expect(resolvePortFromArgs([...prefix, "--port", "abc"])).toBeUndefined();
  });

  test("returns undefined when --port=value value is invalid", () => {
    expect(resolvePortFromArgs([...prefix, "--port=abc"])).toBeUndefined();
  });

  test("equals form takes precedence when both forms appear", () => {
    // Given --port=1111 and a later --port 2222, the equals form wins
    // because .find() stops at the first match. This is a documented
    // invariant of the precedence rule, not an accident.
    const out = resolvePortFromArgs([
      ...prefix,
      "--port=1111",
      "--port",
      "2222",
    ]);
    expect(out).toBe(1111);
  });

  test("ignores unrelated arguments that contain 'port'", () => {
    // `--port-info` must not match the strict `--port` / `--port=` forms.
    expect(
      resolvePortFromArgs([...prefix, "--port-info", "9000"]),
    ).toBeUndefined();
  });
});

describe("parseApiUrl", () => {
  test("returns undefined for missing input", () => {
    expect(parseApiUrl(undefined)).toBeUndefined();
    expect(parseApiUrl("")).toBeUndefined();
  });

  test("parses a full https URL with explicit port", () => {
    expect(parseApiUrl("https://10.0.0.1:27124")).toEqual({
      host: "10.0.0.1",
      port: 27124,
      useHttp: false,
    });
  });

  test("parses a full http URL with explicit port", () => {
    expect(parseApiUrl("http://localhost:27123")).toEqual({
      host: "localhost",
      port: 27123,
      useHttp: true,
    });
  });

  test("omits port when the URL has none", () => {
    // No explicit port: leave `port` undefined so the caller's default
    // (27124 HTTPS / 27123 HTTP) still applies.
    expect(parseApiUrl("https://obsidian.lan")).toEqual({
      host: "obsidian.lan",
      port: undefined,
      useHttp: false,
    });
  });

  test("rejects non-http(s) protocols", () => {
    expect(parseApiUrl("ftp://10.0.0.1:27124")).toBeUndefined();
    expect(parseApiUrl("file:///tmp/foo")).toBeUndefined();
  });

  test("rejects malformed input", () => {
    expect(parseApiUrl("not a url")).toBeUndefined();
    expect(parseApiUrl("://missing-scheme")).toBeUndefined();
  });

  test("rejects out-of-range ports", () => {
    // `new URL` itself throws on ports above 65535 on modern runtimes;
    // the catch path returns undefined. Either way the caller gets a
    // safe fallback to the default port.
    expect(parseApiUrl("https://host:70000")).toBeUndefined();
  });
});

describe("resolveHostOverride — issue #21", () => {
  test("returns undefined for missing input", () => {
    expect(resolveHostOverride(undefined)).toBeUndefined();
    expect(resolveHostOverride("")).toBeUndefined();
  });

  test("treats a bare hostname as host-only (current behaviour)", () => {
    expect(resolveHostOverride("10.0.0.1")).toEqual({ host: "10.0.0.1" });
    expect(resolveHostOverride("obsidian.lan")).toEqual({
      host: "obsidian.lan",
    });
  });

  test("parses a full https URL", () => {
    // The bug: setting OBSIDIAN_HOST=https://10.0.0.1:27124 used to be
    // concatenated under a fixed https:// prefix and produced a
    // malformed BASE_URL. Now the URL form is recognised and parsed.
    expect(resolveHostOverride("https://10.0.0.1:27124")).toEqual({
      host: "10.0.0.1",
      port: 27124,
      useHttp: false,
    });
  });

  test("parses a full http URL with explicit port", () => {
    // The reproduction case from issue #21.
    expect(resolveHostOverride("http://127.0.0.1:27123")).toEqual({
      host: "127.0.0.1",
      port: 27123,
      useHttp: true,
    });
  });

  test("returns undefined for malformed URL forms", () => {
    // Anything containing :// must parse cleanly via parseApiUrl, or
    // we return undefined and let the caller fall back. We do NOT
    // treat a malformed URL as a "bare hostname" — concatenating
    // garbage under https:// is what we are fixing.
    expect(resolveHostOverride("not://a-url")).toBeUndefined();
    expect(resolveHostOverride("ftp://10.0.0.1")).toBeUndefined();
  });

  test("preserves bare hostnames that happen to contain a colon (IPv6 host literal not supported)", () => {
    // Today we only special-case the `://` substring. A raw IPv6
    // literal like `[::1]` is not on the supported-input table for
    // OBSIDIAN_HOST today, but if a user passes one without `://` we
    // pass it through verbatim — the URL constructor in BASE_URL will
    // reject it downstream, which is the expected failure mode.
    expect(resolveHostOverride("[::1]")).toEqual({ host: "[::1]" });
  });
});

describe("normalizePath — issue #37", () => {
  test("leaves a clean path untouched", () => {
    expect(normalizePath("/vault/DevOps")).toBe("/vault/DevOps");
  });

  test("keeps a single trailing slash", () => {
    // A single trailing slash is legitimate on list endpoints (e.g.
    // GET /vault/ lists the vault root). We only collapse duplicates.
    expect(normalizePath("/vault/DevOps/")).toBe("/vault/DevOps/");
  });

  test("collapses a double slash introduced by a trailing user input", () => {
    // The original bug: caller sends directory="DevOps/" and the
    // feature code concatenates it to the `/vault/` prefix, producing
    // `/vault/DevOps//`, which the Local REST API rejects.
    expect(normalizePath("/vault/DevOps//")).toBe("/vault/DevOps/");
  });

  test("collapses arbitrary runs of slashes", () => {
    expect(normalizePath("/a///b////c/")).toBe("/a/b/c/");
  });

  test("collapses a leading double slash", () => {
    expect(normalizePath("//foo")).toBe("/foo");
  });

  test("handles the root path", () => {
    expect(normalizePath("/")).toBe("/");
  });

  test("handles an empty path", () => {
    // Defensive: makeRequest never calls with an empty path today, but
    // the function must not crash if a future caller does.
    expect(normalizePath("")).toBe("");
  });
});
