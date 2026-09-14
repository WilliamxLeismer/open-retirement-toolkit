import type { SimulationResult } from "./domain";

export interface SimulationComparison {
  baselineSuccessRate: number;
  stressedSuccessRate: number;
  successRateDelta: number;
  baselineEndingMedian: number;
  stressedEndingMedian: number;
  endingMedianDelta: number;
}

export function compareSimulationResults(
  baseline: SimulationResult,
  stressed: SimulationResult
): SimulationComparison {
  if (baseline.seed !== stressed.seed || baseline.trials !== stressed.trials) {
    throw new Error("Comparable simulations must use the same seed and trial count.");
  }
  return {
    baselineSuccessRate: baseline.successRate,
    stressedSuccessRate: stressed.successRate,
    successRateDelta: stressed.successRate - baseline.successRate,
    baselineEndingMedian: baseline.endingMedian,
    stressedEndingMedian: stressed.endingMedian,
    endingMedianDelta: stressed.endingMedian - baseline.endingMedian
  };
}
