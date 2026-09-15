import { describe, expect, it } from "vitest";
import { createBackup, getBackupHealth, verifyAndMigrateBackup } from "../src/backup";
import { CURRENT_BACKUP_VERSION } from "../src/scenario-schema";
import { makeScenario } from "./fixtures";

describe("verified backups", () => {
  it("round-trips a checksummed backup", async () => {
    const scenario = makeScenario();
    const backup = await createBackup([scenario], "2026-09-15T12:00:00.000Z");
    expect(backup.version).toBe(CURRENT_BACKUP_VERSION);
    expect(backup.manifest.scenarioCount).toBe(1);
    expect(backup.manifest.checksum).toMatch(/^[0-9a-f]{64}$/);
    await expect(verifyAndMigrateBackup(backup)).resolves.toEqual([scenario]);
  });

  it("rejects modified scenario content", async () => {
    const backup = await createBackup([makeScenario()]);
    backup.scenarios[0].startingBalance += 1;
    await expect(verifyAndMigrateBackup(backup)).rejects.toThrow("checksum failed");
  });

  it("rejects a mismatched scenario count", async () => {
    const backup = await createBackup([makeScenario()]);
    backup.manifest.scenarioCount = 2;
    await expect(verifyAndMigrateBackup(backup)).rejects.toThrow("scenario count");
  });

  it("rejects missing and unsupported integrity metadata", async () => {
    const backup = await createBackup([makeScenario()]);
    const missing = { ...backup, manifest: undefined };
    await expect(verifyAndMigrateBackup(missing)).rejects.toThrow("integrity information");
    const unsupported = { ...backup, manifest: { ...backup.manifest, checksumAlgorithm: "CRC32" } };
    await expect(verifyAndMigrateBackup(unsupported)).rejects.toThrow("unsupported");
  });

  it("continues importing pre-checksum backups", async () => {
    const scenario = makeScenario();
    await expect(verifyAndMigrateBackup({ version: 7, scenarios: [scenario] })).resolves.toEqual([scenario]);
  });

  it("classifies backup age without relying on the current clock", () => {
    const now = new Date("2026-09-15T12:00:00.000Z");
    expect(getBackupHealth(null, now)).toBe("missing");
    expect(getBackupHealth("not-a-date", now)).toBe("missing");
    expect(getBackupHealth("2026-09-01T12:00:00.000Z", now)).toBe("current");
    expect(getBackupHealth("2026-07-01T12:00:00.000Z", now)).toBe("due");
  });
});
