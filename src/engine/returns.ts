import type { Scenario } from "../domain";
import { createMovingBlockGenerator } from "./historical";
import { mulberry32, normalSample } from "./prng";

export interface MonthlyObservation {
  monthlyReturn: number;
  monthlyInflation?: number;
}

export interface ReturnGenerator {
  nextMonthlyObservation(): MonthlyObservation;
}

export function createReturnGenerator(scenario: Scenario): ReturnGenerator {
  if (scenario.model === "deterministic") {
    const monthlyReturn = Math.pow(1 + scenario.expectedReturn, 1 / 12) - 1;
    return { nextMonthlyObservation: () => ({ monthlyReturn }) };
  }

  const random = mulberry32(scenario.seed);
  if (scenario.model === "historical") {
    return createMovingBlockGenerator(scenario.historical, random);
  }
  return {
    nextMonthlyObservation: () => ({
      monthlyReturn: scenario.expectedReturn / 12 +
        scenario.volatility / Math.sqrt(12) * normalSample(random)
    })
  };
}
