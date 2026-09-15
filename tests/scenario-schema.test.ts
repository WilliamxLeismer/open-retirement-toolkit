import { describe, expect, it } from "vitest";
import { CURRENT_SCENARIO_VERSION } from "../src/domain";
import { CURRENT_BACKUP_VERSION, migrateBackup, migrateScenario } from "../src/scenario-schema";

const legacyScenario = {
  id: "legacy",
  name: "Saved before migrations",
  currentAge: 40,
  retirementAge: 65,
  endAge: 95,
  startingBalance: 250000,
  annualContribution: 24000,
  annualSpending: 60000,
  annualRetirementIncome: 0,
  expectedReturn: 0.06,
  volatility: 0.14,
  inflation: 0.025,
  effectiveTaxRate: 0.15,
  taxableWithdrawalShare: 0.75,
  trials: 10000,
  seed: 20260914,
  model: "normal",
  updatedAt: "2026-09-14T00:00:00.000Z"
};

describe("scenario migrations", () => {
  it("upgrades an unversioned scenario with a disabled default overlay", () => {
    expect(migrateScenario(legacyScenario)).toEqual({
      ...legacyScenario,
      version: CURRENT_SCENARIO_VERSION,
      stress: { enabled: false, age: 65, loss: -0.35 },
      historical: { blockMonths: 12, datasetName: "", datasetId: "", rows: [] },
      studentT: { degreesOfFreedom: 5 },
      incomeStreams: [],
      oneTimeExpenses: [],
      taxBuckets: {
        enabled: false,
        startingBalances: { taxable: 75000, taxDeferred: 150000, roth: 25000 },
        contributionShares: { taxable: 0.25, taxDeferred: 0.5, roth: 0.25 },
        withdrawalOrder: "taxable-first",
        taxableGainShare: 0.5
      },
      dollarView: "nominal"
    });
  });

  it("upgrades a version-two scenario", () => {
    const migrated = migrateScenario({ ...legacyScenario, version: 2 });
    expect(migrated.version).toBe(CURRENT_SCENARIO_VERSION);
    expect(migrated.stress.enabled).toBe(false);
  });

  it("imports the original version-one backup format", () => {
    const migrated = migrateBackup({ version: 1, scenarios: [legacyScenario] });
    expect(migrated[0].version).toBe(CURRENT_SCENARIO_VERSION);
    expect(migrated[0].startingBalance).toBe(250000);
  });

  it("rejects future scenario and backup versions", () => {
    expect(() => migrateScenario({ ...legacyScenario, version: CURRENT_SCENARIO_VERSION + 1 })).toThrow("newer version");
    expect(() => migrateBackup({ version: CURRENT_BACKUP_VERSION + 1, scenarios: [legacyScenario] })).toThrow("newer version");
  });

  it("rejects a version-three scenario without stress settings", () => {
    expect(() => migrateScenario({ ...legacyScenario, version: 3 })).toThrow("missing stress");
  });

  it("upgrades a version-three scenario with default historical settings", () => {
    const migrated = migrateScenario({ ...legacyScenario, version: 3, stress: { enabled: false, age: 65, loss: -0.35 } });
    expect(migrated.historical.rows).toEqual([]);
  });

  it("rejects a version-four scenario without historical settings", () => {
    expect(() => migrateScenario({ ...legacyScenario, version: 4, stress: { enabled: false, age: 65, loss: -0.35 } })).toThrow("missing historical");
  });

  it("upgrades a version-four scenario with default Student's t settings", () => {
    const migrated = migrateScenario({
      ...legacyScenario,
      version: 4,
      stress: { enabled: false, age: 65, loss: -0.35 },
      historical: { blockMonths: 12, datasetName: "", datasetId: "", rows: [] }
    });
    expect(migrated.studentT.degreesOfFreedom).toBe(5);
  });

  it("rejects a version-five scenario without Student's t settings", () => {
    expect(() => migrateScenario({
      ...legacyScenario,
      version: 5,
      stress: { enabled: false, age: 65, loss: -0.35 },
      historical: { blockMonths: 12, datasetName: "", datasetId: "", rows: [] }
    })).toThrow("missing Student's t");
  });

  it("upgrades a version-five scenario with an empty cash-flow timeline", () => {
    const migrated = migrateScenario({
      ...legacyScenario,
      version: 5,
      stress: { enabled: false, age: 65, loss: -0.35 },
      historical: { blockMonths: 12, datasetName: "", datasetId: "", rows: [] },
      studentT: { degreesOfFreedom: 5 }
    });
    expect(migrated.incomeStreams).toEqual([]);
    expect(migrated.oneTimeExpenses).toEqual([]);
  });

  it("rejects a version-six scenario without cash-flow timeline settings", () => {
    expect(() => migrateScenario({
      ...legacyScenario,
      version: 6,
      stress: { enabled: false, age: 65, loss: -0.35 },
      historical: { blockMonths: 12, datasetName: "", datasetId: "", rows: [] },
      studentT: { degreesOfFreedom: 5 }
    })).toThrow("missing cash-flow timeline");
  });

  it("upgrades a version-six scenario with the nominal dollar view", () => {
    const migrated = migrateScenario({
      ...legacyScenario,
      version: 6,
      stress: { enabled: false, age: 65, loss: -0.35 },
      historical: { blockMonths: 12, datasetName: "", datasetId: "", rows: [] },
      studentT: { degreesOfFreedom: 5 },
      incomeStreams: [],
      oneTimeExpenses: []
    });
    expect(migrated.dollarView).toBe("nominal");
  });

  it("rejects a version-seven scenario without dollar-view settings", () => {
    expect(() => migrateScenario({
      ...legacyScenario,
      version: 7,
      stress: { enabled: false, age: 65, loss: -0.35 },
      historical: { blockMonths: 12, datasetName: "", datasetId: "", rows: [] },
      studentT: { degreesOfFreedom: 5 },
      incomeStreams: [],
      oneTimeExpenses: []
    })).toThrow("missing dollar-view");
  });

  it("upgrades a version-seven scenario with disabled tax buckets", () => {
    const migrated = migrateScenario({
      ...legacyScenario,
      version: 7,
      stress: { enabled: false, age: 65, loss: -0.35 },
      historical: { blockMonths: 12, datasetName: "", datasetId: "", rows: [] },
      studentT: { degreesOfFreedom: 5 },
      incomeStreams: [],
      oneTimeExpenses: [],
      dollarView: "nominal"
    });
    expect(migrated.taxBuckets.enabled).toBe(false);
    expect(migrated.taxBuckets.startingBalances.taxDeferred).toBe(150000);
  });

  it("rejects a version-eight scenario without tax-bucket settings", () => {
    expect(() => migrateScenario({
      ...legacyScenario,
      version: 8,
      stress: { enabled: false, age: 65, loss: -0.35 },
      historical: { blockMonths: 12, datasetName: "", datasetId: "", rows: [] },
      studentT: { degreesOfFreedom: 5 },
      incomeStreams: [],
      oneTimeExpenses: [],
      dollarView: "nominal"
    })).toThrow("missing tax-bucket");
  });

  it("rejects empty and malformed backups", () => {
    expect(() => migrateBackup({ version: 1, scenarios: [] })).toThrow("does not contain");
    expect(() => migrateBackup({ version: 1, scenarios: [{}] })).toThrow();
  });
});
