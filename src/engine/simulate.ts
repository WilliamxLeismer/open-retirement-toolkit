import type { Scenario, SimulationResult } from "../domain";
import { validateScenario } from "../domain";
import { createReturnGenerator } from "./returns";
import { getModelManifest } from "./model-manifest";
import { oneTimeNetNeedForMonth, oneTimeWithdrawalForMonth, retirementNetNeedForMonth, retirementWithdrawalForMonth } from "./cashflows";
import { summarizeDepletion } from "./depletion";
import { applyStressOverlay } from "./stress";
import { contributeToTaxBuckets, growTaxBuckets, totalTaxBucketBalance, withdrawFromTaxBuckets, type TaxBucketBalances } from "./tax-buckets";
import { ENGINE_VERSION } from "./version";

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
  const yearlyRealBalances = Array.from({ length: years + 1 }, () => [] as number[]);
  const returns = createReturnGenerator(scenario);
  const manifest = getModelManifest(scenario);
  let survived = 0;
  const firstDepletionAges: Array<number | null> = [];
  const endingTaxableBalances: number[] = [];
  const endingTaxDeferredBalances: number[] = [];
  const endingRothBalances: number[] = [];
  const estimatedLifetimeTaxes: number[] = [];

  for (let trial = 0; trial < trials; trial++) {
    let balance = scenario.startingBalance;
    let taxBalances: TaxBucketBalances | undefined = scenario.taxBuckets.enabled ? { ...scenario.taxBuckets.startingBalances } : undefined;
    let estimatedLifetimeTax = 0;
    let sampledInflationFactor = 1;
    let firstDepletionAge: number | null = null;
    yearlyBalances[0].push(balance);
    yearlyRealBalances[0].push(balance);
    for (let month = 0; month < years * 12; month++) {
      const age = scenario.currentAge + month / 12;
      const yearsElapsed = month / 12;
      const observation = returns.nextMonthlyObservation();
      const inflationFactor = observation.monthlyInflation === undefined
        ? Math.pow(1 + scenario.inflation, yearsElapsed)
        : sampledInflationFactor;
      const monthlyReturn = applyStressOverlay(scenario, month, observation.monthlyReturn);
      const growthFactor = Math.max(0, 1 + monthlyReturn);
      if (taxBalances) {
        taxBalances = growTaxBuckets(taxBalances, growthFactor);
        balance = totalTaxBucketBalance(taxBalances);
      } else {
        balance *= growthFactor;
      }

      if (age < scenario.retirementAge) {
        const contribution = scenario.annualContribution * inflationFactor / 12;
        if (taxBalances) {
          taxBalances = contributeToTaxBuckets(taxBalances, contribution, scenario.taxBuckets.contributionShares);
          balance = totalTaxBucketBalance(taxBalances);
        } else {
          balance += contribution;
        }
      } else if (taxBalances) {
        const withdrawal = withdrawFromTaxBuckets(
          taxBalances,
          retirementNetNeedForMonth(scenario, age, inflationFactor),
          scenario.effectiveTaxRate,
          scenario.taxBuckets
        );
        taxBalances = withdrawal.balances;
        estimatedLifetimeTax += withdrawal.estimatedTax;
        balance = totalTaxBucketBalance(taxBalances);
      } else {
        balance = Math.max(0, balance - retirementWithdrawalForMonth(scenario, age, inflationFactor));
      }
      if (taxBalances) {
        const withdrawal = withdrawFromTaxBuckets(
          taxBalances,
          oneTimeNetNeedForMonth(scenario, month, inflationFactor),
          scenario.effectiveTaxRate,
          scenario.taxBuckets
        );
        taxBalances = withdrawal.balances;
        estimatedLifetimeTax += withdrawal.estimatedTax;
        balance = totalTaxBucketBalance(taxBalances);
      } else {
        balance = Math.max(0, balance - oneTimeWithdrawalForMonth(scenario, month, inflationFactor));
      }

      if (observation.monthlyInflation !== undefined) {
        sampledInflationFactor *= 1 + observation.monthlyInflation;
      } else {
        sampledInflationFactor = Math.pow(1 + scenario.inflation, (month + 1) / 12);
      }

      if (balance === 0 && firstDepletionAge === null) firstDepletionAge = scenario.currentAge + (month + 1) / 12;
      if ((month + 1) % 12 === 0) {
        yearlyBalances[(month + 1) / 12].push(balance);
        yearlyRealBalances[(month + 1) / 12].push(balance / sampledInflationFactor);
      }
    }
    if (balance > 0) survived++;
    firstDepletionAges.push(firstDepletionAge);
    if (taxBalances) {
      endingTaxableBalances.push(taxBalances.taxable);
      endingTaxDeferredBalances.push(taxBalances.taxDeferred);
      endingRothBalances.push(taxBalances.roth);
      estimatedLifetimeTaxes.push(estimatedLifetimeTax);
    }
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
  const realPoints = yearlyRealBalances.map((values, year) => {
    const sorted = values.slice().sort((a,b) => a-b);
    return {
      age: scenario.currentAge + year,
      p10: percentile(sorted, 0.1),
      p50: percentile(sorted, 0.5),
      p90: percentile(sorted, 0.9)
    };
  });
  const taxBucketSummary = scenario.taxBuckets.enabled ? {
    endingMedianBalances: {
      taxable: percentile(endingTaxableBalances.sort((a, b) => a - b), 0.5),
      taxDeferred: percentile(endingTaxDeferredBalances.sort((a, b) => a - b), 0.5),
      roth: percentile(endingRothBalances.sort((a, b) => a - b), 0.5)
    },
    medianEstimatedLifetimeTax: percentile(estimatedLifetimeTaxes.sort((a, b) => a - b), 0.5)
  } : undefined;
  return {
    points,
    realPoints,
    successRate: survived / trials,
    endingMedian: points.at(-1)?.p50 ?? 0,
    trials,
    seed: scenario.seed,
    engineVersion: ENGINE_VERSION,
    modelId: manifest.id,
    ...(manifest.datasetId ? { datasetId: manifest.datasetId } : {}),
    depletion: summarizeDepletion(firstDepletionAges, scenario),
    ...(taxBucketSummary ? { taxBuckets: taxBucketSummary } : {})
  };
}
