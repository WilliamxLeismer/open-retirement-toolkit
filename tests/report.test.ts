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
    expect(csv).toContain("manifest,engine_version,,,,,1.1.0");
    expect(csv).toContain("input,stress_enabled,,,,,true");
    expect(csv).toContain("input,stress_loss,,,,,-0.5");
    expect(csv).toContain("timeseries,stressed,62,");
    expect(csv).toContain("timeseries,baseline,62,");
    expect(csv).toContain("Hypothetical educational analysis");
  });
});
