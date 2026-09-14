/// <reference lib="webworker" />
import type { Scenario } from "./domain";
import { simulate } from "./engine/simulate";

self.onmessage = (event: MessageEvent<Scenario>) => {
  try {
    self.postMessage({ ok: true, result: simulate(event.data) });
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : "Simulation failed." });
  }
};
