import { describe, expect, it } from "vitest";
import { parseHistoricalCsv, createMovingBlockGenerator } from "../src/engine/historical";
import { createReturnGenerator } from "../src/engine/returns";
import { simulate } from "../src/engine/simulate";
import { validateScenario, type HistoricalPoint } from "../src/domain";
import { makeScenario } from "./fixtures";

const rows = (count: number): HistoricalPoint[] => Array.from({ length: count }, (_, index) => ({
  date: `${2000 + Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, "0")}`,
  portfolioReturn: index / 100,
  inflation: index / 1000
}));

const historicalScenario = () => makeScenario({
  model: "historical",
  historical: { blockMonths: 12, datasetName: "Test history", datasetId: "test-v1", rows: rows(24) }
});

describe("historical CSV", () => {
  it("parses the documented decimal monthly schema and creates stable provenance", () => {
    const csv = "date,portfolio_return,inflation\n2000-01,0.02,0.001\n2000-02,-0.01,0.002";
    const first = parseHistoricalCsv(csv, "sample.csv");
    const second = parseHistoricalCsv(csv, "sample.csv");
    expect(first.datasetName).toBe("sample");
    expect(first.datasetId).toBe(second.datasetId);
    expect(first.rows[1]).toEqual({ date: "2000-02", portfolioReturn: -0.01, inflation: 0.002 });
  });

  it("rejects missing values and undocumented headers", () => {
    expect(() => parseHistoricalCsv("date,return,inflation\n2000-01,0.1,0.01", "bad.csv")).toThrow("headers");
    expect(() => parseHistoricalCsv("date,portfolio_return,inflation\n2000-01,,0.01", "bad.csv")).toThrow("missing");
  });

  it("validates monthly alignment and minimum block length before simulation", () => {
    const scenario = historicalScenario();
    scenario.historical.rows[1].date = "2000-03";
    expect(validateScenario(scenario)).toContain("Historical dates must be consecutive; check row 2.");
    scenario.historical.rows = rows(11);
    expect(validateScenario(scenario)).toContain("Historical dataset needs at least 12 monthly rows.");
  });
});

describe("moving-block bootstrap", () => {
  it("samples overlapping consecutive blocks and starts a new block after truncation", () => {
    const generator = createMovingBlockGenerator(
      { blockMonths: 12, datasetName: "Test", datasetId: "test", rows: rows(14) },
      () => 0.999
    );
    const sampled = Array.from({ length: 14 }, () => generator.nextMonthlyObservation().monthlyReturn);
    expect(sampled.slice(0, 12)).toEqual(rows(14).slice(2).map(point => point.portfolioReturn));
    expect(sampled.slice(12)).toEqual(rows(14).slice(2, 4).map(point => point.portfolioReturn));
  });

  it("reproduces the exact sequence for an identical seed", () => {
    const scenario = historicalScenario();
    const a = createReturnGenerator(scenario);
    const b = createReturnGenerator(scenario);
    expect(Array.from({ length: 40 }, () => a.nextMonthlyObservation())).toEqual(
      Array.from({ length: 40 }, () => b.nextMonthlyObservation())
    );
  });

  it("keeps sampled return and inflation rows synchronized in the cash-flow engine", () => {
    const constantRows = rows(12).map((point, index) => ({ ...point, portfolioReturn: 0, inflation: 0.01, date: `2000-${String(index + 1).padStart(2, "0")}` }));
    const scenario = makeScenario({
      model: "historical",
      startingBalance: 1000,
      annualContribution: 0,
      annualSpending: 12,
      historical: { blockMonths: 12, datasetName: "One block", datasetId: "one-block", rows: constantRows }
    });
    const expectedEnding = 1000 - Array.from({ length: 12 }, (_, index) => Math.pow(1.01, index + 12)).reduce((a, b) => a + b, 0);
    const result = simulate(scenario);
    expect(result.endingMedian).toBeCloseTo(expectedEnding, 10);
    expect(result.realPoints.at(-1)?.p50).toBeCloseTo(expectedEnding / Math.pow(1.01, 24), 10);
    expect(result.datasetId).toBe("one-block");
    expect(result.modelId).toBe("historical-moving-block-v1");
  });
});
