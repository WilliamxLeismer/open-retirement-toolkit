import { describe, expect, it } from "vitest";
import type { SimulationResult } from "../src/domain";
import { compareSimulationResults, resultInDollarView } from "../src/analysis";

const result = (successRate: number, endingMedian: number): SimulationResult => ({
  points: [],
  realPoints: [],
  successRate,
  endingMedian,
  trials: 10000,
  seed: 42,
  engineVersion: "1.5.0",
  modelId: "normal-v1",
  depletion: { depletionRate: 0, medianDepletionAge: null, beforeRetirementRate: 0, firstTenRetirementYearsRate: 0, laterRetirementRate: 0, byAge: [] }
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

  it("selects real-dollar points and ending balance without mutating the result", () => {
    const nominal = { ...result(1, 200), points: [{ age: 60, p10: 100, p50: 200, p90: 300 }], realPoints: [{ age: 60, p10: 80, p50: 160, p90: 240 }] };
    const real = resultInDollarView(nominal, "real");
    expect(real.points).toEqual(nominal.realPoints);
    expect(real.endingMedian).toBe(160);
    expect(resultInDollarView(nominal, "nominal")).toBe(nominal);
    expect(nominal.endingMedian).toBe(200);
  });
});
