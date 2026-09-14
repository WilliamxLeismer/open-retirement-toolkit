import { describe, expect, it } from "vitest";
import { buildResultCsv } from "../src/report";
import { simulate } from "../src/engine/simulate";
import { withoutStress } from "../src/engine/stress";
import { makeScenario } from "./fixtures";

describe("CSV report", () => {
  it("includes manifest, stress assumptions, baseline, time series, and disclaimer", () => {
    const scenario = makeScenario({
      name: 'Plan, "A"',
      stress: { enabled: true, age: 61, loss: -0.5 }
    });
    const stressed = simulate(scenario);
    const baseline = simulate(withoutStress(scenario));
    const csv = buildResultCsv(scenario, stressed, baseline);

    expect(csv).toContain('manifest,scenario_name,,,,,"Plan, ""A"""');
    expect(csv).toContain("manifest,engine_version,,,,,1.4.0");
    expect(csv).toContain("manifest,model_id,,,,,deterministic-v1");
    expect(csv).toContain("input,stress_enabled,,,,,true");
    expect(csv).toContain("input,stress_loss,,,,,-0.5");
    expect(csv).toContain("timeseries,stressed,62,");
    expect(csv).toContain("timeseries,baseline,62,");
    expect(csv).toContain("Hypothetical educational analysis");
  });

  it("discloses Student's t calibration and the Normal comparison", () => {
    const scenario = makeScenario({ model: "student-t", studentT: { degreesOfFreedom: 8 } });
    const result = simulate(scenario);
    const normal = simulate({ ...scenario, model: "normal" });
    const csv = buildResultCsv(scenario, result, undefined, normal);
    expect(csv).toContain("manifest,model_id,,,,,student-t-v1");
    expect(csv).toContain("input,degrees_of_freedom,,,,,8");
    expect(csv).toContain("input,variance_scaling");
    expect(csv).toContain("summary,normal_comparison_success_rate");
    expect(csv).toContain("timeseries,normal_comparison,62,");
  });

  it("discloses historical dataset provenance and resampling policy", () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({
      date: `2000-${String(index + 1).padStart(2, "0")}`,
      portfolioReturn: 0.01,
      inflation: 0.002
    }));
    const scenario = makeScenario({
      model: "historical",
      historical: { blockMonths: 12, datasetName: "Test history", datasetId: "user-12345678", rows }
    });
    const csv = buildResultCsv(scenario, simulate(scenario));
    expect(csv).toContain("manifest,dataset_name,,,,,Test history");
    expect(csv).toContain("manifest,dataset_id,,,,,user-12345678");
    expect(csv).toContain("manifest,dataset_start,,,,,2000-01");
    expect(csv).toContain("manifest,dataset_end,,,,,2000-12");
    expect(csv).toContain("input,block_months,,,,,12");
    expect(csv).toContain("overlapping blocks sampled with replacement");
  });

  it("exports named income and one-time expense assumptions", () => {
    const scenario = makeScenario({
      incomeStreams: [{ id: "pension", name: "Pension", startAge: 61, endAge: 62, annualAmount: 12000, annualGrowthRate: 0.02, taxableShare: 0.5 }],
      oneTimeExpenses: [{ id: "medical", name: "Medical", age: 61, amount: 5000, inflationAdjusted: true }]
    });
    const csv = buildResultCsv(scenario, simulate(scenario));
    expect(csv).toContain("input,income_stream_1");
    expect(csv).toContain('""name"":""Pension""');
    expect(csv).toContain("input,one_time_expense_1");
    expect(csv).toContain('""name"":""Medical""');
  });
});
