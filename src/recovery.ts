import type { Scenario } from "./domain";

export const RECOVERY_INTERVAL_MS = 10 * 60 * 1000;
export const MAX_RECOVERY_POINTS = 10;

export interface RecoveryPoint {
  id: string;
  scenarioId: string;
  savedAt: string;
  scenario: Scenario;
}

export function scenarioContentChanged(previous: Scenario, next: Scenario): boolean {
  const withoutTimestamp = (scenario: Scenario) => ({ ...scenario, updatedAt: "" });
  return JSON.stringify(withoutTimestamp(previous)) !== JSON.stringify(withoutTimestamp(next));
}

export function shouldCreateRecoveryPoint(
  previous: Scenario | undefined,
  next: Scenario,
  latest: RecoveryPoint | undefined,
  now = new Date(),
  minimumIntervalMs = RECOVERY_INTERVAL_MS
): boolean {
  if (!previous || !scenarioContentChanged(previous, next)) return false;
  if (!latest) return true;
  const lastSaved = new Date(latest.savedAt).getTime();
  return !Number.isFinite(lastSaved) || now.getTime() - lastSaved >= minimumIntervalMs;
}

export function newestRecoveryPoints(points: RecoveryPoint[], maximum = MAX_RECOVERY_POINTS): RecoveryPoint[] {
  return [...points].sort((a, b) => b.savedAt.localeCompare(a.savedAt)).slice(0, maximum);
}
