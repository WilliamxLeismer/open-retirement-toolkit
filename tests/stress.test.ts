import { describe, expect, it } from "vitest";
import {
  applyStressOverlay,
  combineMonthlyReturns,
  stressAdjustmentForMonth,
  stressEventMonth,
  withoutStress
} from "../src/engine/stress";
import { makeScenario } from "./fixtures";

describe("fixed-age stress overlay", () => {
  const stress = { enabled: true, age: 65, loss: -0.5 };

  it("maps the configured age to an exact month", () => {
    expect(stressEventMonth(40, stress)).toBe(300);
    expect(stressAdjustmentForMonth(40, stress, 299)).toBe(0);
    expect(stressAdjustmentForMonth(40, stress, 300)).toBe(-0.5);
  });

  it("compounds the base return and stress adjustment", () => {
    expect(combineMonthlyReturns(0.1, -0.5)).toBeCloseTo(-0.45, 14);
  });

  it("does not alter unshocked returns", () => {
    expect(combineMonthlyReturns(-0.123456789, 0)).toBe(-0.123456789);
    expect(applyStressOverlay(makeScenario(), 12, 0.02)).toBe(0.02);
  });

  it("creates an independent baseline scenario", () => {
    const scenario = makeScenario({ stress: { enabled: true, age: 61, loss: -0.35 } });
    const baseline = withoutStress(scenario);
    expect(baseline.stress.enabled).toBe(false);
    expect(scenario.stress.enabled).toBe(true);
    expect(baseline.stress).not.toBe(scenario.stress);
  });
});
