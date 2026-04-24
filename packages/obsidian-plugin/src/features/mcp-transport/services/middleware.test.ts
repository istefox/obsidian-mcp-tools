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
});
