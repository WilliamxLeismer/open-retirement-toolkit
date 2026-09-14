import type { Scenario } from "../domain";
import { mulberry32, normalSample } from "./prng";

export interface ReturnGenerator {
  nextMonthlyReturn(): number;
}

export function createReturnGenerator(scenario: Scenario): ReturnGenerator {
  if (scenario.model === "deterministic") {
    const monthlyReturn = Math.pow(1 + scenario.expectedReturn, 1 / 12) - 1;
    return { nextMonthlyReturn: () => monthlyReturn };
  }

  const random = mulberry32(scenario.seed);
  return {
    nextMonthlyReturn: () =>
      scenario.expectedReturn / 12 +
      scenario.volatility / Math.sqrt(12) * normalSample(random)
  };
}
