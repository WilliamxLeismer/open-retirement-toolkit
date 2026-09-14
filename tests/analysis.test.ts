import { describe, expect, it } from "vitest";
import type { SimulationResult } from "../src/domain";
import { compareSimulationResults } from "../src/analysis";

const result = (successRate: number, endingMedian: number): SimulationResult => ({
  points: [],
  successRate,
  endingMedian,
  trials: 10000,
  seed: 42,
  engineVersion: "1.1.0"
});

describe("simulation comparison", () => {
  it("calculates stressed-minus-baseline differences", () => {
    const comparison = compareSimulationResults(result(0.9, 300000), result(0.75, 200000));
    expect(comparison.baselineSuccessRate).toBe(0.9);
    expect(comparison.stressedSuccessRate).toBe(0.75);
    expect(comparison.successRateDelta).toBeCloseTo(-0.15, 12);
    expect(comparison.baselineEndingMedian).toBe(300000);
    expect(comparison.stressedEndingMedian).toBe(200000);
    expect(comparison.endingMedianDelta).toBe(-100000);
  });

  it("rejects results generated with different manifests", () => {
    expect(() => compareSimulationResults(
      result(0.9, 300000),
      { ...result(0.8, 200000), seed: 43 }
    )).toThrow("same seed");
  });
});
