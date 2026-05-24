import { beforeEach, describe, expect, test } from "bun:test";
import {
  mockApp,
  resetMockVault,
  setMockFile,
  setMockPeriodicNotesPlugin,
} from "$/test-setup";
import { getOrCreatePeriodicNoteHandler } from "./getOrCreatePeriodicNote";

function parse(result: { content: Array<{ type: "text"; text: string }> }) {
  return JSON.parse(result.content[0].text);
}

describe("get_or_create_periodic_note", () => {
  beforeEach(() => {
    resetMockVault();
  });

  test("weekly fallback — root + YYYY-Www path, created=true", async () => {
    const app = mockApp();
    const res = await getOrCreatePeriodicNoteHandler({
      arguments: { period: "weekly", date: "2026-W21" },
      app,
    });
    const body = parse(res);
    expect(body.period).toBe("weekly");
    expect(body.path).toBe("2026-W21.md");
    expect(body.created).toBe(true);
  });

  test("monthly fallback — existing file returns created=false + content", async () => {
    setMockFile("2026-05.md", "## Monthly review\nq2 ok");
    const app = mockApp();
    const res = await getOrCreatePeriodicNoteHandler({
      arguments: { period: "monthly", date: "2026-05" },
      app,
    });
    const body = parse(res);
    expect(body.created).toBe(false);
    expect(body.content).toContain("Monthly review");
  });

  test("quarterly plugin-on — folder + format from settings", async () => {
    setMockPeriodicNotesPlugin("quarterly", {
      loaded: true,
      folder: "Quarterly",
      format: "YYYY-[Q]Q",
    });
    const app = mockApp();
    const res = await getOrCreatePeriodicNoteHandler({
      arguments: { period: "quarterly", date: "2026-Q2" },
      app,
    });
    const body = parse(res);
    expect(body.path).toBe("Quarterly/2026-Q2.md");
    expect(body.created).toBe(true);
  });

  test("yearly fallback — root + YYYY.md", async () => {
    const app = mockApp();
    const res = await getOrCreatePeriodicNoteHandler({
      arguments: { period: "yearly", date: "2026" },
      app,
    });
    const body = parse(res);
    expect(body.path).toBe("2026.md");
  });

  test("default date — weekly returns today's ISO week shape", async () => {
    const app = mockApp();
    const res = await getOrCreatePeriodicNoteHandler({
      arguments: { period: "weekly" },
      app,
    });
    const body = parse(res);
    expect(body.path).toMatch(/^\d{4}-W\d{2}\.md$/);
  });

  test("invalid quarterly value Q5 → invalid_date_for_period (shape)", async () => {
    const app = mockApp();
    const res = await getOrCreatePeriodicNoteHandler({
      arguments: { period: "quarterly", date: "2026-Q5" },
      app,
    });
    expect(res.isError).toBe(true);
    const body = parse(res);
    expect(body.errorCode).toBe("invalid_date_for_period");
    expect(body.period).toBe("quarterly");
  });

  test("invalid weekly value W99 → invalid_date_for_period (semantic)", async () => {
    const app = mockApp();
    const res = await getOrCreatePeriodicNoteHandler({
      arguments: { period: "weekly", date: "2026-W99" },
      app,
    });
    expect(res.isError).toBe(true);
    const body = parse(res);
    expect(body.errorCode).toBe("invalid_date_for_period");
  });
});
