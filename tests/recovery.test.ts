import { describe, expect, it } from "vitest";
import { newestRecoveryPoints, scenarioContentChanged, shouldCreateRecoveryPoint, type RecoveryPoint } from "../src/recovery";
import { makeScenario } from "./fixtures";

const point = (savedAt: string, balance: number): RecoveryPoint => ({
  id: `test:${savedAt}`,
  scenarioId: "test",
  savedAt,
  scenario: makeScenario({ startingBalance: balance })
});

describe("local recovery policy", () => {
  it("ignores timestamp-only autosaves", () => {
    const previous = makeScenario();
    const next = { ...previous, updatedAt: "2026-09-15T12:00:00.000Z" };
    expect(scenarioContentChanged(previous, next)).toBe(false);
    expect(shouldCreateRecoveryPoint(previous, next, undefined)).toBe(false);
  });

  it("captures the previous content on the first meaningful edit", () => {
    const previous = makeScenario();
    const next = { ...previous, startingBalance: previous.startingBalance + 1 };
    expect(shouldCreateRecoveryPoint(previous, next, undefined)).toBe(true);
  });

  it("throttles rapid automatic recovery points", () => {
    const previous = makeScenario();
    const next = { ...previous, startingBalance: previous.startingBalance + 1 };
    const latest = point("2026-09-15T11:55:00.000Z", previous.startingBalance);
    expect(shouldCreateRecoveryPoint(previous, next, latest, new Date("2026-09-15T12:00:00.000Z"))).toBe(false);
    expect(shouldCreateRecoveryPoint(previous, next, latest, new Date("2026-09-15T12:06:00.000Z"))).toBe(true);
  });

  it("keeps only the newest requested recovery points", () => {
    const points = [point("2026-09-15T10:00:00.000Z", 1), point("2026-09-15T12:00:00.000Z", 2), point("2026-09-15T11:00:00.000Z", 3)];
    expect(newestRecoveryPoints(points, 2).map(item => item.savedAt)).toEqual([
      "2026-09-15T12:00:00.000Z",
      "2026-09-15T11:00:00.000Z"
    ]);
  });
});
