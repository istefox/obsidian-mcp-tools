import { describe, expect, test } from "bun:test";
import { type } from "arktype";
import { semanticSearchSettingsSchema } from "./types";

const BASE = { indexingMode: "live", unloadModelWhenIdle: true } as const;

describe("semanticSearchSettingsSchema — provider union", () => {
  const valid = [
    "native",
    "smart-connections",
    "auto",
    "embedding-gemma",
    "multilingual-e5-base",
  ] as const;

  for (const provider of valid) {
    test(`accepts "${provider}"`, () => {
      const result = semanticSearchSettingsSchema({ ...BASE, provider });
      expect(result instanceof type.errors).toBe(false);
    });
  }

  test("rejects unknown provider value", () => {
    const result = semanticSearchSettingsSchema({
      ...BASE,
      provider: "unknown-provider",
    });
    expect(result instanceof type.errors).toBe(true);
  });
});
