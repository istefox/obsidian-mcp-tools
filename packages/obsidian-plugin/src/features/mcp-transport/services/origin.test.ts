import { describe, expect, test } from "bun:test";
import { isOriginAllowed } from "./origin";

describe("isOriginAllowed", () => {
  test("allows missing Origin header (non-browser clients)", () => {
    expect(isOriginAllowed(undefined)).toBe(true);
    expect(isOriginAllowed(null)).toBe(true);
  });

  test("allows 127.0.0.1 with any port", () => {
    expect(isOriginAllowed("http://127.0.0.1:27200")).toBe(true);
    expect(isOriginAllowed("http://127.0.0.1")).toBe(true);
    expect(isOriginAllowed("https://127.0.0.1:8080")).toBe(true);
  });

  test("allows localhost with any port", () => {
    expect(isOriginAllowed("http://localhost:27200")).toBe(true);
    expect(isOriginAllowed("http://localhost")).toBe(true);
    expect(isOriginAllowed("https://localhost:443")).toBe(true);
  });

  test("rejects non-loopback IPs even if private", () => {
    expect(isOriginAllowed("http://192.168.1.1:27200")).toBe(false);
    expect(isOriginAllowed("http://10.0.0.1")).toBe(false);
    expect(isOriginAllowed("http://example.com")).toBe(false);
  });

  test("rejects file:// and chrome-extension://", () => {
    expect(isOriginAllowed("file:///home/user/evil.html")).toBe(false);
    expect(isOriginAllowed("chrome-extension://abc")).toBe(false);
  });

  test("rejects loopback-looking strings that are not the prefix", () => {
    expect(isOriginAllowed("http://127.0.0.1.evil.com")).toBe(false);
    expect(isOriginAllowed("http://localhost.attacker.com")).toBe(false);
  });
});
