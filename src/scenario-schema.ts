import { CURRENT_SCENARIO_VERSION, defaultScenario, validateScenario, type Scenario } from "./domain";

export const CURRENT_BACKUP_VERSION = 7 as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const REQUIRED_LEGACY_FIELDS = [
  "id", "name", "currentAge", "retirementAge", "endAge", "startingBalance",
  "annualContribution", "annualSpending", "annualRetirementIncome",
  "expectedReturn", "volatility", "inflation", "effectiveTaxRate",
  "taxableWithdrawalShare", "trials", "seed", "model", "updatedAt"
] as const;

export function migrateScenario(input: unknown): Scenario {
  if (!isRecord(input)) throw new Error("Scenario must be an object.");
  const sourceVersion = input.version === undefined ? 1 : input.version;
  if (typeof sourceVersion !== "number" || !Number.isInteger(sourceVersion) || sourceVersion < 1) {
    throw new Error("Scenario version is invalid.");
  }
  if (sourceVersion > CURRENT_SCENARIO_VERSION) {
    throw new Error("This scenario was created by a newer version of Open Retirement Toolkit.");
  }
  const missing = REQUIRED_LEGACY_FIELDS.filter(key => !(key in input));
  if (missing.length) throw new Error("Scenario is missing required fields: " + missing.join(", ") + ".");
  if (sourceVersion >= 3 && !("stress" in input)) throw new Error("Scenario is missing stress overlay settings.");
  if (sourceVersion >= 4 && !("historical" in input)) throw new Error("Scenario is missing historical bootstrap settings.");
  if (sourceVersion >= 5 && !("studentT" in input)) throw new Error("Scenario is missing Student's t settings.");
  if (sourceVersion >= 6 && (!("incomeStreams" in input) || !("oneTimeExpenses" in input))) throw new Error("Scenario is missing cash-flow timeline settings.");
  if (sourceVersion >= 7 && !("dollarView" in input)) throw new Error("Scenario is missing dollar-view settings.");

  const defaults = defaultScenario();
  const migrated = {
    ...defaults,
    ...input,
    version: CURRENT_SCENARIO_VERSION,
    stress: sourceVersion < 3 ? defaults.stress : input.stress,
    historical: sourceVersion < 4 ? defaults.historical : input.historical,
    studentT: sourceVersion < 5 ? defaults.studentT : input.studentT,
    incomeStreams: sourceVersion < 6 ? defaults.incomeStreams : input.incomeStreams,
    oneTimeExpenses: sourceVersion < 6 ? defaults.oneTimeExpenses : input.oneTimeExpenses,
    dollarView: sourceVersion < 7 ? defaults.dollarView : input.dollarView,
    id: typeof input.id === "string" && input.id ? input.id : defaults.id,
    updatedAt: typeof input.updatedAt === "string" && input.updatedAt ? input.updatedAt : defaults.updatedAt
  } as Scenario;
  const errors = validateScenario(migrated);
  if (errors.length) throw new Error(errors.join(" "));
  return migrated;
}

export function migrateBackup(input: unknown): Scenario[] {
  let scenarios: unknown;
  if (Array.isArray(input)) {
    scenarios = input;
  } else if (isRecord(input)) {
    const backupVersion = input.version === undefined ? 1 : input.version;
    if (typeof backupVersion !== "number" || !Number.isInteger(backupVersion) || backupVersion < 1) {
      throw new Error("Backup version is invalid.");
    }
    if (backupVersion > CURRENT_BACKUP_VERSION) {
      throw new Error("This backup was created by a newer version of Open Retirement Toolkit.");
    }
    scenarios = input.scenarios;
  }
  if (!Array.isArray(scenarios) || scenarios.length === 0) {
    throw new Error("The backup does not contain any scenarios.");
  }
  return scenarios.map(migrateScenario);
}
