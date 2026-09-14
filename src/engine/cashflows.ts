import type { IncomeStream, Scenario } from "../domain";

export function monthlyNetIncome(stream: IncomeStream, age: number, effectiveTaxRate: number): number {
  if (age < stream.startAge || age >= stream.endAge) return 0;
  const yearsSinceStart = age - stream.startAge;
  const grossAnnual = stream.annualAmount * Math.pow(1 + stream.annualGrowthRate, yearsSinceStart);
  return grossAnnual * (1 - effectiveTaxRate * stream.taxableShare) / 12;
}

export function retirementWithdrawalForMonth(scenario: Scenario, age: number, inflationFactor: number): number {
  if (age < scenario.retirementAge) return 0;
  const spending = scenario.annualSpending * inflationFactor / 12;
  const legacyIncome = scenario.annualRetirementIncome * inflationFactor / 12;
  const namedIncome = scenario.incomeStreams.reduce(
    (total, stream) => total + monthlyNetIncome(stream, age, scenario.effectiveTaxRate),
    0
  );
  const netNeed = Math.max(0, spending - legacyIncome - namedIncome);
  const taxDrag = scenario.effectiveTaxRate * scenario.taxableWithdrawalShare;
  return netNeed / Math.max(0.01, 1 - taxDrag);
}

export function oneTimeWithdrawalForMonth(scenario: Scenario, month: number, inflationFactor: number): number {
  const taxDrag = scenario.effectiveTaxRate * scenario.taxableWithdrawalShare;
  return scenario.oneTimeExpenses.reduce((total, expense) => {
    const eventMonth = (expense.age - scenario.currentAge) * 12;
    if (month !== eventMonth) return total;
    const netNeed = expense.amount * (expense.inflationAdjusted ? inflationFactor : 1);
    return total + netNeed / Math.max(0.01, 1 - taxDrag);
  }, 0);
}
