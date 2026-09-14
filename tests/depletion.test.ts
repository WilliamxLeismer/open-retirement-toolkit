import { describe, expect, it } from "vitest";
import { summarizeDepletion } from "../src/engine/depletion";
import { simulate } from "../src/engine/simulate";
import { makeScenario } from "./fixtures";

describe("depletion analysis", () => {
  it("summarizes survival timing across the planning horizon", () => {
    const scenario = makeScenario({ currentAge: 40, retirementAge: 65, endAge: 95 });
    const summary = summarizeDepletion([null, 60, 65, 70, 80, 80], scenario);
    expect(summary.depletionRate).toBeCloseTo(5 / 6, 12);
    expect(summary.medianDepletionAge).toBe(70);
    expect(summary.beforeRetirementRate).toBeCloseTo(2 / 6, 12);
    expect(summary.firstTenRetirementYearsRate).toBeCloseTo(1 / 6, 12);
    expect(summary.laterRetirementRate).toBeCloseTo(2 / 6, 12);
    expect(summary.byAge).toEqual([
      { age: 60, trials: 1, rate: 1 / 6 },
      { age: 65, trials: 1, rate: 1 / 6 },
      { age: 70, trials: 1, rate: 1 / 6 },
      { age: 80, trials: 2, rate: 2 / 6 }
    ]);
  });

  it("reports no median or age rows when no trial depletes", () => {
    expect(summarizeDepletion([null, null], makeScenario())).toMatchObject({
      depletionRate: 0,
      medianDepletionAge: null,
      byAge: []
    });
    expect(() => summarizeDepletion([], makeScenario())).toThrow("at least one trial");
  });

  it("records the first zero-balance month in an engine run", () => {
    const result = simulate(makeScenario({
      startingBalance: 100,
      annualContribution: 0,
      annualSpending: 1200
    }));
    expect(result.successRate).toBe(0);
    expect(result.depletion.depletionRate).toBe(1);
    expect(result.depletion.medianDepletionAge).toBeCloseTo(61 + 1 / 12, 12);
    expect(result.depletion.byAge).toEqual([{ age: 61, trials: 1, rate: 1 }]);
  });

  it("computes real balances using the trial's accumulated inflation", () => {
    const result = simulate(makeScenario({
      startingBalance: 100,
      annualContribution: 0,
      annualSpending: 0,
      inflation: 0.12
    }));
    expect(result.points.at(-1)?.p50).toBe(100);
    expect(result.realPoints.at(-1)?.p50).toBeCloseTo(100 / Math.pow(1.12, 2), 12);
  });
});
