import type { Scenario } from "./domain";
import { CURRENT_BACKUP_VERSION, migrateBackup } from "./scenario-schema";

export const BACKUP_FORMAT = "open-retirement-toolkit" as const;
export const BACKUP_CHECKSUM_ALGORITHM = "SHA-256" as const;

export interface BackupEnvelope {
  version: typeof CURRENT_BACKUP_VERSION;
  exportedAt: string;
  manifest: {
    format: typeof BACKUP_FORMAT;
    scenarioCount: number;
    checksumAlgorithm: typeof BACKUP_CHECKSUM_ALGORITHM;
    checksum: string;
  };
  scenarios: Scenario[];
}

export type BackupHealth = "missing" | "current" | "due";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const checksumInput = (exportedAt: string, scenarios: Scenario[]) =>
  JSON.stringify({ version: CURRENT_BACKUP_VERSION, exportedAt, scenarios });

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function createBackup(scenarios: Scenario[], exportedAt = new Date().toISOString()): Promise<BackupEnvelope> {
  if (!scenarios.length) throw new Error("There are no scenarios to back up.");
  const migrated = scenarios.map(scenario => migrateBackup({ version: CURRENT_BACKUP_VERSION, scenarios: [scenario] })[0]);
  const checksum = await sha256Hex(checksumInput(exportedAt, migrated));
  return {
    version: CURRENT_BACKUP_VERSION,
    exportedAt,
    manifest: {
      format: BACKUP_FORMAT,
      scenarioCount: migrated.length,
      checksumAlgorithm: BACKUP_CHECKSUM_ALGORITHM,
      checksum
    },
    scenarios: migrated
  };
}

export async function verifyAndMigrateBackup(input: unknown): Promise<Scenario[]> {
  if (!isRecord(input)) throw new Error("Backup must be an object.");
  const scenarios = migrateBackup(input);
  if (input.version !== CURRENT_BACKUP_VERSION) return scenarios;
  if (typeof input.exportedAt !== "string" || !input.exportedAt || !isRecord(input.manifest)) {
    throw new Error("Backup integrity information is missing.");
  }
  const manifest = input.manifest;
  if (manifest.format !== BACKUP_FORMAT || manifest.checksumAlgorithm !== BACKUP_CHECKSUM_ALGORITHM) {
    throw new Error("Backup format or checksum algorithm is unsupported.");
  }
  if (manifest.scenarioCount !== scenarios.length) throw new Error("Backup scenario count does not match its manifest.");
  if (typeof manifest.checksum !== "string") throw new Error("Backup checksum is missing.");
  const checksum = await sha256Hex(checksumInput(input.exportedAt, scenarios));
  if (checksum !== manifest.checksum) throw new Error("Backup checksum failed. The file may be incomplete or modified.");
  return scenarios;
}

export function getBackupHealth(lastExportAt: string | null, now = new Date(), dueAfterDays = 30): BackupHealth {
  if (!lastExportAt) return "missing";
  const exported = new Date(lastExportAt);
  if (!Number.isFinite(exported.getTime())) return "missing";
  return now.getTime() - exported.getTime() > dueAfterDays * 86_400_000 ? "due" : "current";
}
