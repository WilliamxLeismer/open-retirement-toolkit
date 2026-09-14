import type { DepletionSummary, Scenario } from "../domain";

const median = (values: number[]): number => {
  const middle = (values.length - 1) / 2;
  const lower = Math.floor(middle);
  const upper = Math.ceil(middle);
  return (values[lower] + values[upper]) / 2;
};

export function summarizeDepletion(firstDepletionAges: Array<number | null>, scenario: Scenario): DepletionSummary {
  const trials = firstDepletionAges.length;
  if (!trials) throw new Error("Depletion analysis requires at least one trial.");
  const depleted = firstDepletionAges.filter((age): age is number => age !== null).sort((a, b) => a - b);
  const counts = new Map<number, number>();
  for (const age of depleted) {
    const bucket = Math.floor(age);
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  const rate = (count: number) => count / trials;
  return {
    depletionRate: rate(depleted.length),
    medianDepletionAge: depleted.length ? median(depleted) : null,
    beforeRetirementRate: rate(depleted.filter(age => age <= scenario.retirementAge).length),
    firstTenRetirementYearsRate: rate(depleted.filter(age => age > scenario.retirementAge && age <= scenario.retirementAge + 10).length),
    laterRetirementRate: rate(depleted.filter(age => age > scenario.retirementAge + 10).length),
    byAge: [...counts.entries()].map(([age, count]) => ({ age, trials: count, rate: rate(count) }))
  };
}
