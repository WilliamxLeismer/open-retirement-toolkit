import { describe, expect, it } from "vitest";
import { createReturnGenerator } from "../src/engine/returns";
import { makeScenario } from "./fixtures";

describe("return generators", () => {
  it("preserves the original seeded Normal sequence", () => {
    const generator = createReturnGenerator(makeScenario({
      model: "normal",
      expectedReturn: 0.05,
      volatility: 0.12
    }));
    expect([generator.nextMonthlyReturn(), generator.nextMonthlyReturn(), generator.nextMonthlyReturn()]).toEqual([
      -0.028955764564766798,
      -0.005291235042319541,
      -0.05962917038623787
    ]);
  });

  it("compounds deterministic annual return to its monthly equivalent", () => {
    const generator = createReturnGenerator(makeScenario({
      model: "deterministic",
      expectedReturn: 0.05
    }));
    expect(Math.pow(1 + generator.nextMonthlyReturn(), 12)).toBeCloseTo(1.05, 12);
  });
});
