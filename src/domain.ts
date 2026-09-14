export const CURRENT_SCENARIO_VERSION = 3 as const;
export type ReturnModel = "deterministic" | "normal";

export interface StressOverlay {
  enabled: boolean;
  age: number;
  loss: number;
}

export interface Scenario {
  version: typeof CURRENT_SCENARIO_VERSION;
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
  stress: StressOverlay;
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
  engineVersion: string;
}

export const defaultScenario = (): Scenario => ({
  version: CURRENT_SCENARIO_VERSION,
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
  stress: { enabled: false, age: 65, loss: -0.35 },
  updatedAt: new Date().toISOString()
});

export function validateScenario(s: Scenario): string[] {
  const errors: string[] = [];
  const value = s as unknown as Record<string, unknown>;
  const finite = (key: keyof Scenario, label: string) => {
    const candidate = value[key];
    if (typeof candidate !== "number" || !Number.isFinite(candidate)) {
      errors.push(label + " must be a finite number.");
      return undefined;
    }
    return candidate;
  };

  if (value.version !== CURRENT_SCENARIO_VERSION) errors.push("Scenario version is unsupported.");
  if (typeof value.id !== "string" || !value.id) errors.push("Scenario ID is missing.");
  if (typeof value.name !== "string" || !value.name.trim()) errors.push("Give the scenario a name.");
  if (value.model !== "deterministic" && value.model !== "normal") errors.push("Return model is unsupported.");
  if (typeof value.updatedAt !== "string" || !value.updatedAt) errors.push("Updated date is missing.");

  const currentAge = finite("currentAge", "Current age");
  const retirementAge = finite("retirementAge", "Retirement age");
  const endAge = finite("endAge", "Plan-through age");
  if (currentAge !== undefined && (currentAge < 18 || currentAge > 100)) errors.push("Current age must be between 18 and 100.");
  if (retirementAge !== undefined && currentAge !== undefined && (retirementAge <= currentAge || retirementAge > 110)) errors.push("Retirement age must be after current age.");
  if (endAge !== undefined && retirementAge !== undefined && (endAge <= retirementAge || endAge > 120)) errors.push("Plan-through age must be after retirement age.");

  for (const [key, label] of [["startingBalance","Starting balance"],["annualContribution","Annual contribution"],["annualSpending","Annual spending"],["annualRetirementIncome","Retirement income"]] as const) {
    const candidate = finite(key, label);
    if (candidate !== undefined && candidate < 0) errors.push(label + " cannot be negative.");
  }

  const expectedReturn = finite("expectedReturn", "Expected return");
  const volatility = finite("volatility", "Volatility");
  const inflation = finite("inflation", "Inflation");
  const effectiveTaxRate = finite("effectiveTaxRate", "Tax rate");
  const taxableWithdrawalShare = finite("taxableWithdrawalShare", "Taxable withdrawal share");
  const trials = finite("trials", "Trials");
  const seed = finite("seed", "Seed");

  if (expectedReturn !== undefined && (expectedReturn < -0.5 || expectedReturn > 0.5)) errors.push("Expected return must be between -50% and 50%.");
  if (volatility !== undefined && (volatility < 0 || volatility > 1)) errors.push("Volatility must be between 0% and 100%.");
  if (inflation !== undefined && (inflation < -0.1 || inflation > 0.25)) errors.push("Inflation must be between -10% and 25%.");
  if (effectiveTaxRate !== undefined && (effectiveTaxRate < 0 || effectiveTaxRate >= 1)) errors.push("Tax rate must be at least 0% and below 100%.");
  if (taxableWithdrawalShare !== undefined && (taxableWithdrawalShare < 0 || taxableWithdrawalShare > 1)) errors.push("Taxable withdrawal share must be between 0% and 100%.");
  if (trials !== undefined && (!Number.isInteger(trials) || trials < 100 || trials > 50000)) errors.push("Trials must be an integer from 100 to 50,000.");
  if (seed !== undefined && !Number.isInteger(seed)) errors.push("Seed must be a whole number.");

  const stress = value.stress;
  if (typeof stress !== "object" || stress === null || Array.isArray(stress)) {
    errors.push("Stress overlay settings are missing.");
  } else {
    const settings = stress as Record<string, unknown>;
    if (typeof settings.enabled !== "boolean") errors.push("Stress overlay enabled state is invalid.");
    if (typeof settings.age !== "number" || !Number.isInteger(settings.age)) {
      errors.push("Stress-event age must be a whole number.");
    } else if (settings.enabled && currentAge !== undefined && endAge !== undefined && (settings.age < currentAge || settings.age >= endAge)) {
      errors.push("Stress-event age must be within the planning horizon.");
    }
    if (typeof settings.loss !== "number" || !Number.isFinite(settings.loss) || settings.loss < -1 || settings.loss > 0) {
      errors.push("Stress loss must be between 0% and 100%.");
    } else if (settings.enabled && settings.loss === 0) {
      errors.push("Enabled stress loss must be greater than 0%.");
    }
  }
  return errors;
}
