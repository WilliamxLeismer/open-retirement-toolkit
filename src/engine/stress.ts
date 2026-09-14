import type { Scenario, StressOverlay } from "../domain";

export function stressEventMonth(currentAge: number, stress: StressOverlay): number {
  return (stress.age - currentAge) * 12;
}

export function stressAdjustmentForMonth(currentAge: number, stress: StressOverlay, month: number): number {
  if (!stress.enabled) return 0;
  return month === stressEventMonth(currentAge, stress) ? stress.loss : 0;
}

export function combineMonthlyReturns(baseReturn: number, stressAdjustment: number): number {
  if (stressAdjustment === 0) return baseReturn;
  return (1 + baseReturn) * (1 + stressAdjustment) - 1;
}

export function applyStressOverlay(scenario: Scenario, month: number, baseReturn: number): number {
  return combineMonthlyReturns(
    baseReturn,
    stressAdjustmentForMonth(scenario.currentAge, scenario.stress, month)
  );
}

export function withoutStress(scenario: Scenario): Scenario {
  return {
    ...scenario,
    stress: { ...scenario.stress, enabled: false }
  };
}
