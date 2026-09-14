import { describe, expect, it } from "vitest";
import { CURRENT_SCENARIO_VERSION, type Scenario } from "../src/domain";
import { createReturnGenerator } from "../src/engine/returns";

const base: Scenario = {
  version: CURRENT_SCENARIO_VERSION,
  id: "returns",
  name: "Returns",
  currentAge: 40,
  retirementAge: 65,
  endAge: 95,
  startingBalance: 100000,
  annualContribution: 0,
  annualSpending: 0,
  annualRetirementIncome: 0,
  expectedReturn: 0.05,
  volatility: 0.12,
  inflation: 0,
  effectiveTaxRate: 0,
  taxableWithdrawalShare: 0,
  trials: 100,
  seed: 42,
  model: "normal",
  updatedAt: "2026-09-14T00:00:00.000Z"
};

describe("return generators", () => {
  it("preserves the original seeded Normal sequence", () => {
    const generator = createReturnGenerator(base);
    expect([generator.nextMonthlyReturn(), generator.nextMonthlyReturn(), generator.nextMonthlyReturn()]).toEqual([
      -0.028955764564766798,
      -0.005291235042319541,
      -0.05962917038623787
    ]);
  });

  it("compounds deterministic annual return to its monthly equivalent", () => {
    const generator = createReturnGenerator({ ...base, model: "deterministic" });
    expect(Math.pow(1 + generator.nextMonthlyReturn(), 12)).toBeCloseTo(1.05, 12);
  });
});
