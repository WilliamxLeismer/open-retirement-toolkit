export type ReturnModel = "deterministic" | "normal";

export interface Scenario {
  id: string;
  name: string;
  currentAge: number;
  retirementAge: number;
  endAge: number;
  startingBalance: number;
  annualContribution: number;
  annualSpending: number;
  annualRetirementIncome: number;
  expectedReturn: number;
  volatility: number;
  inflation: number;
  effectiveTaxRate: number;
  taxableWithdrawalShare: number;
  trials: number;
  seed: number;
  model: ReturnModel;
  updatedAt: string;
}

export interface ResultPoint {
  age: number;
  p10: number;
  p50: number;
  p90: number;
}

export interface SimulationResult {
  points: ResultPoint[];
  successRate: number;
  endingMedian: number;
  trials: number;
  seed: number;
}

export const defaultScenario = (): Scenario => ({
  id: crypto.randomUUID(),
  name: "My retirement plan",
  currentAge: 40,
  retirementAge: 65,
  endAge: 95,
  startingBalance: 250000,
  annualContribution: 24000,
  annualSpending: 60000,
  annualRetirementIncome: 0,
  expectedReturn: 0.06,
  volatility: 0.14,
  inflation: 0.025,
  effectiveTaxRate: 0.15,
  taxableWithdrawalShare: 0.75,
  trials: 10000,
  seed: 20260914,
  model: "normal",
  updatedAt: new Date().toISOString()
});

export function validateScenario(s: Scenario): string[] {
  const errors: string[] = [];
  if (!s.name.trim()) errors.push("Give the scenario a name.");
  if (s.currentAge < 18 || s.currentAge > 100) errors.push("Current age must be between 18 and 100.");
  if (s.retirementAge <= s.currentAge || s.retirementAge > 110) errors.push("Retirement age must be after current age.");
  if (s.endAge <= s.retirementAge || s.endAge > 120) errors.push("Plan-through age must be after retirement age.");
  for (const [label, value] of [["Starting balance",s.startingBalance],["Annual contribution",s.annualContribution],["Annual spending",s.annualSpending],["Retirement income",s.annualRetirementIncome]] as const) {
    if (!Number.isFinite(value) || value < 0) errors.push(label + " cannot be negative.");
  }
  if (s.expectedReturn < -0.5 || s.expectedReturn > 0.5) errors.push("Expected return must be between -50% and 50%.");
  if (s.volatility < 0 || s.volatility > 1) errors.push("Volatility must be between 0% and 100%.");
  if (s.inflation < -0.1 || s.inflation > 0.25) errors.push("Inflation must be between -10% and 25%.");
  if (s.effectiveTaxRate < 0 || s.effectiveTaxRate >= 1) errors.push("Tax rate must be at least 0% and below 100%.");
  if (s.taxableWithdrawalShare < 0 || s.taxableWithdrawalShare > 1) errors.push("Taxable withdrawal share must be between 0% and 100%.");
  if (!Number.isInteger(s.trials) || s.trials < 100 || s.trials > 50000) errors.push("Trials must be an integer from 100 to 50,000.");
  if (!Number.isInteger(s.seed)) errors.push("Seed must be a whole number.");
  return errors;
}
