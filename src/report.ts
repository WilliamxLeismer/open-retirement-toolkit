import type { Scenario, SimulationResult } from "./domain";

const csvCell = (value: string | number | boolean) => {
  const text = String(value);
  return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
};

const row = (...values: Array<string | number | boolean>) =>
  values.map(csvCell).join(",");

export function buildResultCsv(
  scenario: Scenario,
  stressed: SimulationResult,
  baseline?: SimulationResult
): string {
  const rows = [
    row("record_type","key","age","p10","p50","p90","value"),
    row("manifest","scenario_name","","","","",scenario.name),
    row("manifest","engine_version","","","","",stressed.engineVersion),
    row("manifest","model","","","","",scenario.model),
    row("manifest","seed","","","","",scenario.seed),
    row("input","stress_enabled","","","","",scenario.stress.enabled),
    row("input","stress_age","","","","",scenario.stress.age),
    row("input","stress_loss","","","","",scenario.stress.loss),
    row("summary","stressed_success_rate","","","","",stressed.successRate),
    row("summary","stressed_ending_median","","","","",stressed.endingMedian)
  ];
  if (baseline) {
    rows.push(
      row("summary","baseline_success_rate","","","","",baseline.successRate),
      row("summary","baseline_ending_median","","","","",baseline.endingMedian)
    );
  }
  for (const point of stressed.points) {
    rows.push(row("timeseries","stressed",point.age,point.p10,point.p50,point.p90,""));
  }
  if (baseline) {
    for (const point of baseline.points) {
      rows.push(row("timeseries","baseline",point.age,point.p10,point.p50,point.p90,""));
    }
  }
  rows.push(row("warning","disclaimer","","","","","Hypothetical educational analysis, not financial advice."));
  return rows.join("\n");
}
