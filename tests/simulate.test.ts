import { describe, expect, it } from "vitest";
import { CURRENT_SCENARIO_VERSION, type Scenario } from "../src/domain";
import { simulate } from "../src/engine/simulate";

const scenario = (overrides: Partial<Scenario> = {}): Scenario => ({
  version: CURRENT_SCENARIO_VERSION,
  id: "test",
  name: "Test",
  currentAge: 60,
  retirementAge: 61,
  endAge: 62,
  startingBalance: 100000,
  annualContribution: 12000,
  annualSpending: 12000,
  annualRetirementIncome: 0,
  expectedReturn: 0,
  volatility: 0,
  inflation: 0,
  effectiveTaxRate: 0,
  taxableWithdrawalShare: 0,
  trials: 100,
  seed: 42,
  model: "deterministic",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides
});

describe("simulate", () => {
  it("applies accumulation then retirement cash flows", () => {
    const result = simulate(scenario());
    expect(result.points.map(point => point.p50)).toEqual([100000,112000,100000]);
    expect(result.successRate).toBe(1);
  });

  it("preserves the seeded Normal-model regression result", () => {
    const result = simulate(scenario({ model: "normal", expectedReturn: 0.05, volatility: 0.12 }));
    expect(result).toEqual({
      points: [
        { age: 60, p10: 100000, p50: 100000, p90: 100000 },
        { age: 61, p10: 103718.41020465917, p50: 117656.84160834819, p90: 132323.16634435693 },
        { age: 62, p10: 92109.88660662538, p50: 109907.9427454746, p90: 135448.62373772575 }
      ],
      successRate: 1,
      endingMedian: 109907.9427454746,
      trials: 100,
      seed: 42
    });
  });

  it("repeats seeded normal simulations exactly", () => {
    const input = scenario({ model: "normal", expectedReturn: 0.05, volatility: 0.12 });
    expect(simulate(input)).toEqual(simulate(input));
  });

  it("rejects an invalid age horizon", () => {
    expect(() => simulate(scenario({ retirementAge: 60 }))).toThrow("Retirement age");
  });
});
