import type { Scenario, SimulationResult } from "../domain";
import { validateScenario } from "../domain";
import { mulberry32, normalSample } from "./prng";

const percentile = (sorted: number[], p: number) => {
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const fraction = index - lower;
  return sorted[lower] + (sorted[Math.min(lower + 1, sorted.length - 1)] - sorted[lower]) * fraction;
};

export function simulate(scenario: Scenario): SimulationResult {
  const errors = validateScenario(scenario);
  if (errors.length) throw new Error(errors.join(" "));
  const trials = scenario.model === "deterministic" ? 1 : scenario.trials;
  const years = scenario.endAge - scenario.currentAge;
  const yearlyBalances = Array.from({ length: years + 1 }, () => [] as number[]);
  const random = mulberry32(scenario.seed);
  let survived = 0;

  for (let trial = 0; trial < trials; trial++) {
    let balance = scenario.startingBalance;
    yearlyBalances[0].push(balance);
    for (let month = 0; month < years * 12; month++) {
      const age = scenario.currentAge + month / 12;
      const yearsElapsed = month / 12;
      const inflationFactor = Math.pow(1 + scenario.inflation, yearsElapsed);
      const monthlyReturn = scenario.model === "deterministic"
        ? Math.pow(1 + scenario.expectedReturn, 1 / 12) - 1
        : scenario.expectedReturn / 12 + scenario.volatility / Math.sqrt(12) * normalSample(random);
      balance *= Math.max(0, 1 + monthlyReturn);

      if (age < scenario.retirementAge) {
        balance += scenario.annualContribution * inflationFactor / 12;
      } else {
        const netNeed = Math.max(0, scenario.annualSpending - scenario.annualRetirementIncome) * inflationFactor;
        const taxDrag = scenario.effectiveTaxRate * scenario.taxableWithdrawalShare;
        const grossWithdrawal = netNeed / Math.max(0.01, 1 - taxDrag);
        balance = Math.max(0, balance - grossWithdrawal / 12);
      }

      if ((month + 1) % 12 === 0) yearlyBalances[(month + 1) / 12].push(balance);
    }
    if (balance > 0) survived++;
  }

  const points = yearlyBalances.map((values, year) => {
    const sorted = values.slice().sort((a,b) => a-b);
    return {
      age: scenario.currentAge + year,
      p10: percentile(sorted, 0.1),
      p50: percentile(sorted, 0.5),
      p90: percentile(sorted, 0.9)
    };
  });
  return {
    points,
    successRate: survived / trials,
    endingMedian: points.at(-1)?.p50 ?? 0,
    trials,
    seed: scenario.seed
  };
}
