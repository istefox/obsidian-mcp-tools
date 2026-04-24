import { describe, expect, test } from "bun:test";
import { checkMethodAndPath } from "./middleware";

describe("checkMethodAndPath", () => {
  test("accepts POST /mcp", () => {
    expect(checkMethodAndPath("POST", "/mcp")).toEqual({ ok: true });
  });

  test("accepts GET /mcp", () => {
    expect(checkMethodAndPath("GET", "/mcp")).toEqual({ ok: true });
  });

  test("accepts /mcp/ with trailing slash", () => {
    expect(checkMethodAndPath("POST", "/mcp/")).toEqual({ ok: true });
  });

  test("accepts /mcp/session-id subpaths", () => {
    expect(checkMethodAndPath("POST", "/mcp/abc123")).toEqual({ ok: true });
  });

  test("rejects PUT /mcp with 405", () => {
    expect(checkMethodAndPath("PUT", "/mcp")).toEqual({
      ok: false,
      status: 405,
    });
  });

  test("rejects POST /other with 404", () => {
    expect(checkMethodAndPath("POST", "/other")).toEqual({
      ok: false,
      status: 404,
    });
  });

  test("rejects POST / with 404", () => {
    expect(checkMethodAndPath("POST", "/")).toEqual({ ok: false, status: 404 });
  });

  test("strips query string before path check", () => {
    expect(checkMethodAndPath("POST", "/mcp?foo=bar")).toEqual({ ok: true });
  });

  test("strips query string on a rejected path too", () => {
    expect(checkMethodAndPath("POST", "/other?foo=bar")).toEqual({ ok: false, status: 404 });
  });

  test("treats undefined method as disallowed (405) on valid path", () => {
    expect(checkMethodAndPath(undefined, "/mcp")).toEqual({ ok: false, status: 405 });
  });

  test("treats undefined url as 404", () => {
    expect(checkMethodAndPath("POST", undefined)).toEqual({ ok: false, status: 404 });
  });
});
