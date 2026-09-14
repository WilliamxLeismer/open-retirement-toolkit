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
  if (scenario.model === "student-t") {
    return {
      id: "student-t-v1",
      label: "Student's t Monte Carlo",
      warning: `Advanced model with ${scenario.studentT.degreesOfFreedom} degrees of freedom. It gives extreme returns more weight than the Normal model and is not an industry-standard default. Returns below -100% deplete wealth at the portfolio layer.`
    };
  }
  return {
    id: "normal-v1",
    label: "Normal Monte Carlo",
    warning: "Assumes independent Normally distributed monthly portfolio returns."
  };
}
