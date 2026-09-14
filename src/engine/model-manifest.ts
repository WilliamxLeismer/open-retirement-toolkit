import type { Scenario } from "../domain";

export interface ModelManifest {
  id: string;
  label: string;
  warning: string;
  datasetId?: string;
}

export function getModelManifest(scenario: Scenario): ModelManifest {
  if (scenario.model === "deterministic") {
    return {
      id: "deterministic-v1",
      label: "Deterministic",
      warning: "Uses one constant compounded return and does not model market uncertainty."
    };
  }
  if (scenario.model === "historical") {
    return {
      id: "historical-moving-block-v1",
      label: "Historical moving-block bootstrap",
      datasetId: scenario.historical.datasetId,
      warning: "Resamples the imported history. It cannot represent events or structural changes outside that sample."
    };
  }
  return {
    id: "normal-v1",
    label: "Normal Monte Carlo",
    warning: "Assumes independent Normally distributed monthly portfolio returns."
  };
}
