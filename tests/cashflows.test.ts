import { describe, expect, it } from "vitest";
import { monthlyNetIncome, oneTimeNetNeedForMonth, oneTimeWithdrawalForMonth, retirementNetNeedForMonth, retirementWithdrawalForMonth } from "../src/engine/cashflows";
import { simulate } from "../src/engine/simulate";
import { validateScenario } from "../src/domain";
import { makeScenario } from "./fixtures";

const income = {
  id: "income-1", name: "Pension", startAge: 65, endAge: 90,
  annualAmount: 12000, annualGrowthRate: 0.02, taxableShare: 0.5
};

describe("cash-flow timeline", () => {
  it("applies income timing, compound growth, and taxable share", () => {
    expect(monthlyNetIncome(income, 64.99, 0.2)).toBe(0);
    expect(monthlyNetIncome(income, 65, 0.2)).toBe(900);
    expect(monthlyNetIncome(income, 66, 0.2)).toBeCloseTo(918, 12);
    expect(monthlyNetIncome(income, 90, 0.2)).toBe(0);
  });

  it("combines named income with spending before grossing up portfolio withdrawals", () => {
    const scenario = makeScenario({
      effectiveTaxRate: 0.2,
      taxableWithdrawalShare: 0.5,
      incomeStreams: [{ ...income, startAge: 61, endAge: 62, annualGrowthRate: 0 }]
    });
    expect(retirementWithdrawalForMonth(scenario, 61, 1)).toBeCloseTo((1000 - 900) / 0.9, 12);
    expect(retirementNetNeedForMonth(scenario, 61, 1)).toBeCloseTo(100, 12);
  });

  it("applies one-time expenses only at the selected age and optionally inflates them", () => {
    const scenario = makeScenario({
      effectiveTaxRate: 0.2,
      taxableWithdrawalShare: 0.5,
      oneTimeExpenses: [{ id: "expense-1", name: "Medical", age: 61, amount: 10000, inflationAdjusted: true }]
    });
    expect(oneTimeWithdrawalForMonth(scenario, 11, 1.1)).toBe(0);
    expect(oneTimeWithdrawalForMonth(scenario, 12, 1.1)).toBeCloseTo(11000 / 0.9, 12);
    expect(oneTimeNetNeedForMonth(scenario, 12, 1.1)).toBeCloseTo(11000, 12);
    expect(oneTimeWithdrawalForMonth(scenario, 13, 1.1)).toBe(0);
  });

  it("keeps the documented return, recurring cash-flow, then one-time-expense order", () => {
    const result = simulate(makeScenario({
      startingBalance: 100,
      annualContribution: 12,
      annualSpending: 12,
      oneTimeExpenses: [{ id: "expense-1", name: "Repair", age: 60, amount: 50, inflationAdjusted: false }]
    }));
    expect(result.points.map(point => point.p50)).toEqual([100, 62, 50]);
  });

  it("lets a named income stream fully cover retirement spending", () => {
    const result = simulate(makeScenario({
      annualContribution: 0,
      annualSpending: 12000,
      incomeStreams: [{ id: "income-1", name: "Pension", startAge: 61, endAge: 62, annualAmount: 12000, annualGrowthRate: 0, taxableShare: 0 }]
    }));
    expect(result.endingMedian).toBe(100000);
  });

  it("validates timeline names, ages, amounts, growth, taxes, and inflation flags", () => {
    const scenario = makeScenario({
      incomeStreams: [{ ...income, startAge: 59, endAge: 59, annualAmount: -1, annualGrowthRate: -1, taxableShare: 2 }],
      oneTimeExpenses: [{ id: "expense-1", name: "Bad", age: 62, amount: -1, inflationAdjusted: "yes" as unknown as boolean }]
    });
    const errors = validateScenario(scenario).join(" ");
    expect(errors).toContain("Income stream 1 ages");
    expect(errors).toContain("Income stream 1 amount");
    expect(errors).toContain("Income stream 1 growth");
    expect(errors).toContain("Income stream 1 taxable share");
    expect(errors).toContain("One-time expense 1 age");
    expect(errors).toContain("One-time expense 1 amount");
    expect(errors).toContain("One-time expense 1 inflation setting");
  });
});
