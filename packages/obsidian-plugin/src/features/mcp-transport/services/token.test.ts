import { describe, expect, test } from "bun:test";
import { generateToken, compareTokens } from "./token";

describe("generateToken", () => {
  test("produces a base64url string of at least 32 characters", () => {
    const token = generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(32);
  });

  test("produces distinct tokens across calls", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) tokens.add(generateToken());
    expect(tokens.size).toBe(100);
  });
});

describe("compareTokens", () => {
  test("returns true for identical tokens", () => {
    const token = generateToken();
    expect(compareTokens(token, token)).toBe(true);
  });

  test("returns false for distinct tokens", () => {
    expect(compareTokens(generateToken(), generateToken())).toBe(false);
  });

  test("returns false for tokens of different lengths without throwing", () => {
    expect(compareTokens("abc", "abcd")).toBe(false);
  });

  test("returns false for empty vs nonempty", () => {
    expect(compareTokens("", generateToken())).toBe(false);
  });
});
