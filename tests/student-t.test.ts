import { describe, expect, it } from "vitest";
import { mulberry32 } from "../src/engine/prng";
import { standardizedStudentTSample } from "../src/engine/student-t";
import { createReturnGenerator } from "../src/engine/returns";
import { simulate } from "../src/engine/simulate";
import { validateScenario } from "../src/domain";
import { makeScenario } from "./fixtures";

const moments = (values: number[]) => {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
  return { mean, standardDeviation: Math.sqrt(variance) };
};

const samples = (degreesOfFreedom: number, seed: number, count = 60000) => {
  const random = mulberry32(seed);
  return Array.from({ length: count }, () => standardizedStudentTSample(random, degreesOfFreedom));
};

describe("standardized Student's t", () => {
  it("rejects distributions without finite variance", () => {
    expect(() => standardizedStudentTSample(mulberry32(1), 2)).toThrow("greater than 2");
  });

  it("preserves zero mean and unit variance after scaling", () => {
    const result = moments(samples(5, 42));
    expect(Math.abs(result.mean)).toBeLessThan(0.02);
    expect(result.standardDeviation).toBeGreaterThan(0.96);
    expect(result.standardDeviation).toBeLessThan(1.04);
  });

  it("produces more extreme observations at lower degrees of freedom", () => {
    const extremeRate = (values: number[]) => values.filter(value => Math.abs(value) > 3).length / values.length;
    expect(extremeRate(samples(5, 7))).toBeGreaterThan(extremeRate(samples(30, 7)) * 1.5);
  });

  it("approaches Normal central coverage at 30 degrees of freedom", () => {
    const values = samples(30, 99);
    const centralRate = values.filter(value => Math.abs(value) <= 1.96).length / values.length;
    expect(centralRate).toBeGreaterThan(0.94);
    expect(centralRate).toBeLessThan(0.96);
  });

  it("reproduces the exact seeded return sequence", () => {
    const scenario = makeScenario({ model: "student-t", expectedReturn: 0.05, volatility: 0.12 });
    const first = createReturnGenerator(scenario);
    const second = createReturnGenerator(scenario);
    expect(Array.from({ length: 20 }, () => first.nextMonthlyObservation())).toEqual(
      Array.from({ length: 20 }, () => second.nextMonthlyObservation())
    );
  });

  it("uses the shared monthly cash-flow engine in a hand-calculated zero-volatility case", () => {
    const result = simulate(makeScenario({
      model: "student-t",
      expectedReturn: 0.12,
      volatility: 0,
      annualContribution: 0,
      annualSpending: 0
    }));
    expect(result.endingMedian).toBeCloseTo(100000 * Math.pow(1.01, 24), 8);
    expect(result.modelId).toBe("student-t-v1");
  });

  it("restricts scenarios to calibrated degrees-of-freedom presets", () => {
    const scenario = makeScenario({ model: "student-t", studentT: { degreesOfFreedom: 5 } });
    (scenario.studentT as { degreesOfFreedom: number }).degreesOfFreedom = 2;
    expect(validateScenario(scenario)).toContain("Student's t degrees of freedom must be 3, 5, 8, or 30 and greater than 2.");
  });
});
