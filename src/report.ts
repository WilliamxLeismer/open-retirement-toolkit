import type { Scenario, SimulationResult } from "./domain";
import { getModelManifest } from "./engine/model-manifest";

const csvCell = (value: string | number | boolean) => {
  const text = String(value);
  return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
};

const row = (...values: Array<string | number | boolean>) =>
  values.map(csvCell).join(",");

export function buildResultCsv(
  scenario: Scenario,
  stressed: SimulationResult,
  baseline?: SimulationResult,
  modelBaseline?: SimulationResult
): string {
  const manifest = getModelManifest(scenario);
  const rows = [
    row("record_type","key","age","p10","p50","p90","value"),
    row("manifest","scenario_name","","","","",scenario.name),
    row("manifest","engine_version","","","","",stressed.engineVersion),
    row("manifest","model","","","","",scenario.model),
    row("manifest","model_id","","","","",manifest.id),
    row("manifest","seed","","","","",scenario.seed),
    row("input","stress_enabled","","","","",scenario.stress.enabled),
    row("input","stress_age","","","","",scenario.stress.age),
    row("input","stress_loss","","","","",scenario.stress.loss),
    row("input","dollar_view","","","","",scenario.dollarView),
    row("summary","stressed_success_rate","","","","",stressed.successRate),
    row("summary","stressed_ending_median","","","","",stressed.endingMedian),
    row("summary","depletion_rate","","","","",stressed.depletion.depletionRate),
    row("summary","median_depletion_age","","","","",stressed.depletion.medianDepletionAge ?? ""),
    row("summary","depletion_by_retirement_rate","","","","",stressed.depletion.beforeRetirementRate),
    row("summary","depletion_first_ten_retirement_years_rate","","","","",stressed.depletion.firstTenRetirementYearsRate),
    row("summary","depletion_later_retirement_rate","","","","",stressed.depletion.laterRetirementRate)
  ];
  if (scenario.model === "historical") {
    rows.splice(9, 0,
      row("manifest","dataset_name","","","","",scenario.historical.datasetName),
      row("manifest","dataset_id","","","","",scenario.historical.datasetId),
      row("manifest","dataset_start","","","","",scenario.historical.rows[0]?.date ?? ""),
      row("manifest","dataset_end","","","","",scenario.historical.rows.at(-1)?.date ?? ""),
      row("input","block_months","","","","",scenario.historical.blockMonths),
      row("input","replacement_policy","","","","","overlapping blocks sampled with replacement")
    );
  }
  if (scenario.model === "student-t") {
    rows.splice(9, 0,
      row("input","degrees_of_freedom","","","","",scenario.studentT.degreesOfFreedom),
      row("input","return_mean_units","","","","","annual arithmetic mean divided by 12"),
      row("input","volatility_units","","","","","annual standard deviation divided by square root of 12"),
      row("input","variance_scaling","","","","","sqrt((degrees_of_freedom - 2) / degrees_of_freedom)")
    );
  }
  for (const [index, stream] of scenario.incomeStreams.entries()) {
    rows.push(row("input",`income_stream_${index + 1}`,"","","","",JSON.stringify(stream)));
  }
  for (const [index, expense] of scenario.oneTimeExpenses.entries()) {
    rows.push(row("input",`one_time_expense_${index + 1}`,"","","","",JSON.stringify(expense)));
  }
  if (baseline) {
    rows.push(
      row("summary","baseline_success_rate","","","","",baseline.successRate),
      row("summary","baseline_ending_median","","","","",baseline.endingMedian)
    );
  }
  if (modelBaseline) {
    rows.push(
      row("summary","normal_comparison_success_rate","","","","",modelBaseline.successRate),
      row("summary","normal_comparison_ending_median","","","","",modelBaseline.endingMedian)
    );
    for (const point of modelBaseline.points) {
      rows.push(row("timeseries","normal_comparison",point.age,point.p10,point.p50,point.p90,""));
    }
    for (const point of modelBaseline.realPoints) {
      rows.push(row("timeseries","normal_comparison_real",point.age,point.p10,point.p50,point.p90,""));
    }
  }
  for (const point of stressed.points) {
    rows.push(row("timeseries","stressed",point.age,point.p10,point.p50,point.p90,""));
  }
  for (const point of stressed.realPoints) {
    rows.push(row("timeseries","stressed_real",point.age,point.p10,point.p50,point.p90,""));
  }
  for (const point of stressed.depletion.byAge) {
    rows.push(row("depletion","first_depletion",point.age,"","","",point.rate));
  }
  if (baseline) {
    for (const point of baseline.points) {
      rows.push(row("timeseries","baseline",point.age,point.p10,point.p50,point.p90,""));
    }
    for (const point of baseline.realPoints) {
      rows.push(row("timeseries","baseline_real",point.age,point.p10,point.p50,point.p90,""));
    }
  }
  rows.push(
    row("warning","model_limit","","","","",manifest.warning),
    row("warning","disclaimer","","","","","Hypothetical educational analysis, not financial advice.")
  );
  return rows.join("\n");
}
