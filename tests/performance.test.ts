import { describe, expect, it } from "vitest";
import { simulate } from "../src/engine/simulate";
import { makeScenario } from "./fixtures";

describe("desktop performance smoke test", () => {
  it("completes a 10,000-trial, 55-year Normal simulation within the CI guardrail", () => {
    const scenario = makeScenario({
      currentAge: 40,
      retirementAge: 65,
      endAge: 95,
      model: "normal",
      expectedReturn: 0.06,
      volatility: 0.14,
      trials: 10000
    });
    const started = performance.now();
    const result = simulate(scenario);
    const elapsedMilliseconds = performance.now() - started;
    expect(result.trials).toBe(10000);
    expect(result.points).toHaveLength(56);
    expect(elapsedMilliseconds).toBeLessThan(15000);
  }, 20000);

  it("completes tax-bucket accounting at 10,000 trials within the CI guardrail", () => {
    const scenario = makeScenario({
      currentAge: 40,
      retirementAge: 65,
      endAge: 95,
      model: "normal",
      expectedReturn: 0.06,
      volatility: 0.14,
      trials: 10000,
      startingBalance: 250000,
      taxBuckets: {
        enabled: true,
        startingBalances: { taxable: 75000, taxDeferred: 150000, roth: 25000 },
        contributionShares: { taxable: 0.25, taxDeferred: 0.5, roth: 0.25 },
        withdrawalOrder: "taxable-first",
        taxableGainShare: 0.5
      }
    });
    const started = performance.now();
    const result = simulate(scenario);
    const elapsedMilliseconds = performance.now() - started;
    expect(result.taxBuckets).toBeDefined();
    expect(elapsedMilliseconds).toBeLessThan(15000);
  }, 20000);
});
