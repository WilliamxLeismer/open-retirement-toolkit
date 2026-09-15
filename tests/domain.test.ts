import { describe, expect, it } from "vitest";
import { validateScenario, type HistoricalPoint, type Scenario } from "../src/domain";
import { makeScenario } from "./fixtures";

const validate = (overrides: Record<string, unknown>) =>
  validateScenario({ ...makeScenario(), ...overrides } as Scenario);

const historicalRows = (): HistoricalPoint[] => Array.from({ length: 12 }, (_, index) => ({
  date: `2025-${String(index + 1).padStart(2, "0")}`,
  portfolioReturn: 0.01,
  inflation: 0.002
}));

describe("scenario validation edge cases", () => {
  it("rejects malformed identity, model, display, and finite-number fields", () => {
    const errors = validate({
      version: 0, id: "", name: " ", model: "unknown", updatedAt: "", dollarView: "future",
      currentAge: NaN, retirementAge: Infinity, endAge: "95", startingBalance: NaN,
      annualContribution: Infinity, annualSpending: "12000", annualRetirementIncome: NaN,
      expectedReturn: NaN, volatility: Infinity, inflation: "2%", effectiveTaxRate: NaN,
      taxableWithdrawalShare: Infinity, trials: NaN, seed: "42"
    });
    expect(errors).toEqual(expect.arrayContaining([
      "Scenario version is unsupported.", "Scenario ID is missing.", "Give the scenario a name.",
      "Return model is unsupported.", "Updated date is missing.", "Dollar display must be nominal or real.",
      "Current age must be a finite number.", "Starting balance must be a finite number.",
      "Seed must be a finite number."
    ]));
  });

  it("rejects impossible ages, negative cash values, and out-of-range rates", () => {
    const errors = validate({
      currentAge: 17, retirementAge: 17, endAge: 17,
      startingBalance: -1, annualContribution: -1, annualSpending: -1, annualRetirementIncome: -1,
      expectedReturn: 0.51, volatility: -0.01, inflation: 0.26, effectiveTaxRate: 1,
      taxableWithdrawalShare: 1.01, trials: 100.5, seed: 1.5
    });
    expect(errors).toEqual(expect.arrayContaining([
      "Current age must be between 18 and 100.", "Retirement age must be after current age.",
      "Plan-through age must be after retirement age.", "Starting balance cannot be negative.",
      "Expected return must be between -50% and 50%.", "Trials must be an integer from 100 to 50,000.",
      "Seed must be a whole number."
    ]));
  });

  it("rejects missing and invalid stress settings", () => {
    expect(validate({ stress: null })).toContain("Stress overlay settings are missing.");
    const invalid = validate({ stress: { enabled: "yes", age: 60.5, loss: -2 } });
    expect(invalid).toEqual(expect.arrayContaining([
      "Stress overlay enabled state is invalid.", "Stress-event age must be a whole number.",
      "Stress loss must be between 0% and 100%."
    ]));
    expect(validate({ stress: { enabled: true, age: 59, loss: 0 } })).toEqual(expect.arrayContaining([
      "Stress-event age must be within the planning horizon.", "Enabled stress loss must be greater than 0%."
    ]));
  });

  it("rejects missing historical settings, rows, and dataset metadata", () => {
    expect(validate({ historical: null })).toContain("Historical bootstrap settings are missing.");
    expect(validate({ historical: { blockMonths: 13, rows: null } })).toEqual(expect.arrayContaining([
      "Historical block length must be 12, 24, or 60 months.", "Historical dataset rows are missing."
    ]));
    const errors = validate({
      model: "historical",
      historical: { blockMonths: 12, datasetName: "", datasetId: "", rows: [] }
    });
    expect(errors).toEqual(expect.arrayContaining([
      "Import a named historical dataset.", "Historical dataset needs at least 12 monthly rows."
    ]));
  });

  it.each([
    ["invalid row", [null], "Historical row 1 is invalid."],
    ["invalid date", [{ date: "2025-13", portfolioReturn: 0, inflation: 0 }], "needs a YYYY-MM date"],
    ["date gap", historicalRows().map((row, index) => index === 1 ? { ...row, date: "2025-03" } : row), "must be consecutive"],
    ["invalid return", historicalRows().map((row, index) => index === 0 ? { ...row, portfolioReturn: -1 } : row), "invalid portfolio return"],
    ["invalid inflation", historicalRows().map((row, index) => index === 0 ? { ...row, inflation: -1 } : row), "invalid inflation"]
  ])("rejects %s in imported history", (_label, rows, message) => {
    const errors = validate({
      model: "historical",
      historical: { blockMonths: 12, datasetName: "History", datasetId: "sha256:test", rows }
    });
    expect(errors.join(" ")).toContain(message);
  });

  it("rejects missing and unsupported Student's t settings", () => {
    expect(validate({ studentT: null })).toContain("Student's t settings are missing.");
    expect(validate({ studentT: { degreesOfFreedom: 2 } })).toContain("Student's t degrees of freedom must be 3, 5, 8, or 30 and greater than 2.");
  });

  it("rejects malformed income streams and one-time expenses", () => {
    expect(validate({ incomeStreams: null, oneTimeExpenses: null })).toEqual(expect.arrayContaining([
      "Income streams are missing.", "One-time expenses are missing."
    ]));
    const identityErrors = validate({ incomeStreams: [null], oneTimeExpenses: [null] });
    expect(identityErrors).toEqual(expect.arrayContaining([
      "Income stream 1 needs an ID and name.", "One-time expense 1 needs an ID and name."
    ]));
    const detailErrors = validate({
      incomeStreams: [{ id: "income", name: "Income", startAge: 59, endAge: 59, annualAmount: -1, annualGrowthRate: -1, taxableShare: 2 }],
      oneTimeExpenses: [{ id: "expense", name: "Expense", age: 62, amount: -1, inflationAdjusted: "yes" }]
    });
    expect(detailErrors).toEqual(expect.arrayContaining([
      "Income stream 1 ages must be whole years within the plan and end after they start.",
      "Income stream 1 amount cannot be negative.", "Income stream 1 growth must be above -100% and no more than 100%.",
      "Income stream 1 taxable share must be between 0% and 100%.",
      "One-time expense 1 age must be a whole year within the plan.", "One-time expense 1 amount cannot be negative.",
      "One-time expense 1 inflation setting is invalid."
    ]));
  });
});
