import { describe, expect, it } from "vitest";
import { simulate } from "../src/engine/simulate";
import { makeScenario } from "./fixtures";

describe("simulate", () => {
  it("applies accumulation then retirement cash flows", () => {
    const result = simulate(makeScenario());
    expect(result.points.map(point => point.p50)).toEqual([100000,112000,100000]);
    expect(result.successRate).toBe(1);
  });

  it("preserves the seeded Normal-model regression result when stress is disabled", () => {
    const result = simulate(makeScenario({ model: "normal", expectedReturn: 0.05, volatility: 0.12 }));
    expect(result).toEqual({
      points: [
        { age: 60, p10: 100000, p50: 100000, p90: 100000 },
        { age: 61, p10: 103718.41020465917, p50: 117656.84160834819, p90: 132323.16634435693 },
        { age: 62, p10: 92109.88660662538, p50: 109907.9427454746, p90: 135448.62373772575 }
      ],
      realPoints: [
        { age: 60, p10: 100000, p50: 100000, p90: 100000 },
        { age: 61, p10: 103718.41020465917, p50: 117656.84160834819, p90: 132323.16634435693 },
        { age: 62, p10: 92109.88660662538, p50: 109907.9427454746, p90: 135448.62373772575 }
      ],
      successRate: 1,
      endingMedian: 109907.9427454746,
      trials: 100,
      seed: 42,
      engineVersion: "1.6.0",
      modelId: "normal-v1",
      depletion: {
        depletionRate: 0,
        medianDepletionAge: null,
        beforeRetirementRate: 0,
        firstTenRetirementYearsRate: 0,
        laterRetirementRate: 0,
        byAge: []
      }
    });
  });

  it("applies a fixed-age portfolio loss before that month's cash flow", () => {
    const result = simulate(makeScenario({
      startingBalance: 100000,
      annualContribution: 0,
      annualSpending: 0,
      stress: { enabled: true, age: 61, loss: -0.5 }
    }));
    expect(result.points.map(point => point.p50)).toEqual([100000,100000,50000]);
  });

  it("repeats seeded normal simulations exactly", () => {
    const input = makeScenario({ model: "normal", expectedReturn: 0.05, volatility: 0.12 });
    expect(simulate(input)).toEqual(simulate(input));
  });

  it("preserves zero-tax totals when tax-bucket accounting is enabled", () => {
    const scenario = makeScenario({
      taxBuckets: {
        enabled: true,
        startingBalances: { taxable: 30000, taxDeferred: 60000, roth: 10000 },
        contributionShares: { taxable: 0.25, taxDeferred: 0.5, roth: 0.25 },
        withdrawalOrder: "taxable-first",
        taxableGainShare: 0.5
      }
    });
    const result = simulate(scenario);
    expect(result.points.map(point => point.p50)).toEqual([100000, 112000, 100000]);
    expect(result.taxBuckets?.medianEstimatedLifetimeTax).toBe(0);
    expect(Object.values(result.taxBuckets!.endingMedianBalances).reduce((sum, value) => sum + value, 0)).toBe(100000);
  });

  it("tracks gross tax-deferred withdrawals and estimated taxes", () => {
    const result = simulate(makeScenario({
      model: "normal",
      annualContribution: 0,
      effectiveTaxRate: 0.2,
      taxBuckets: {
        enabled: true,
        startingBalances: { taxable: 0, taxDeferred: 100000, roth: 0 },
        contributionShares: { taxable: 0, taxDeferred: 1, roth: 0 },
        withdrawalOrder: "tax-deferred-first",
        taxableGainShare: 0.5
      }
    }));
    expect(result.endingMedian).toBeCloseTo(85000, 8);
    expect(result.taxBuckets?.endingMedianBalances.taxDeferred).toBeCloseTo(85000, 8);
    expect(result.taxBuckets?.medianEstimatedLifetimeTax).toBeCloseTo(3000, 8);
  });

  it("rejects an invalid age horizon", () => {
    expect(() => simulate(makeScenario({ retirementAge: 60 }))).toThrow("Retirement age");
  });
});
