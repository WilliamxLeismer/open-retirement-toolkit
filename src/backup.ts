import type { Scenario } from "./domain";
import { CURRENT_BACKUP_VERSION, migrateBackup } from "./scenario-schema";

export const BACKUP_FORMAT = "open-retirement-toolkit" as const;
export const BACKUP_CHECKSUM_ALGORITHM = "SHA-256" as const;
export const ENCRYPTED_BACKUP_FORMAT = "open-retirement-toolkit-encrypted" as const;
export const ENCRYPTED_BACKUP_VERSION = 1 as const;
export const BACKUP_ENCRYPTION_ALGORITHM = "AES-GCM" as const;
export const BACKUP_KEY_DERIVATION = "PBKDF2-HMAC-SHA-256" as const;
export const BACKUP_KEY_ITERATIONS = 600_000 as const;
const BACKUP_SALT_BYTES = 16;
const BACKUP_IV_BYTES = 12;

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

export interface EncryptedBackupEnvelope {
  version: typeof ENCRYPTED_BACKUP_VERSION;
  format: typeof ENCRYPTED_BACKUP_FORMAT;
  exportedAt: string;
  encryption: {
    algorithm: typeof BACKUP_ENCRYPTION_ALGORITHM;
    keyDerivation: typeof BACKUP_KEY_DERIVATION;
    iterations: typeof BACKUP_KEY_ITERATIONS;
    salt: string;
    iv: string;
  };
  ciphertext: string;
}

export type BackupHealth = "missing" | "current" | "due";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const checksumInput = (exportedAt: string, scenarios: unknown[]) =>
  JSON.stringify({ version: CURRENT_BACKUP_VERSION, exportedAt, scenarios });

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const base64ToBytes = (value: unknown, label: string): Uint8Array<ArrayBuffer> => {
  if (typeof value !== "string" || !value || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error(`Encrypted backup ${label} is invalid.`);
  }
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    if (bytesToBase64(bytes) !== value) throw new Error("Non-canonical base64");
    return bytes;
  } catch {
    throw new Error(`Encrypted backup ${label} is invalid.`);
  }
};

const requirePassphrase = (passphrase: string) => {
  if (passphrase.length < 12) throw new Error("Backup passphrase must contain at least 12 characters.");
};

const deriveBackupKey = async (passphrase: string, salt: Uint8Array<ArrayBuffer>, usages: KeyUsage[]): Promise<CryptoKey> => {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: BACKUP_KEY_ITERATIONS, hash: "SHA-256" },
    material,
    { name: BACKUP_ENCRYPTION_ALGORITHM, length: 256 },
    false,
    usages
  );
};

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

export async function createEncryptedBackup(
  scenarios: Scenario[],
  passphrase: string,
  exportedAt = new Date().toISOString()
): Promise<EncryptedBackupEnvelope> {
  requirePassphrase(passphrase);
  const backup = await createBackup(scenarios, exportedAt);
  const salt = crypto.getRandomValues(new Uint8Array(BACKUP_SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(BACKUP_IV_BYTES));
  const key = await deriveBackupKey(passphrase, salt, ["encrypt"]);
  const ciphertext = await crypto.subtle.encrypt(
    { name: BACKUP_ENCRYPTION_ALGORITHM, iv },
    key,
    new TextEncoder().encode(JSON.stringify(backup))
  );
  return {
    version: ENCRYPTED_BACKUP_VERSION,
    format: ENCRYPTED_BACKUP_FORMAT,
    exportedAt,
    encryption: {
      algorithm: BACKUP_ENCRYPTION_ALGORITHM,
      keyDerivation: BACKUP_KEY_DERIVATION,
      iterations: BACKUP_KEY_ITERATIONS,
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv)
    },
    ciphertext: bytesToBase64(new Uint8Array(ciphertext))
  };
}

export function isEncryptedBackup(input: unknown): input is EncryptedBackupEnvelope {
  return isRecord(input) && input.format === ENCRYPTED_BACKUP_FORMAT;
}

export async function decryptAndVerifyBackup(input: unknown, passphrase: string): Promise<Scenario[]> {
  if (!isEncryptedBackup(input)) throw new Error("This is not an encrypted Open Retirement Toolkit backup.");
  if (input.version !== ENCRYPTED_BACKUP_VERSION) throw new Error("Encrypted backup version is unsupported.");
  if (!isRecord(input.encryption)) throw new Error("Encrypted backup settings are missing.");
  const settings = input.encryption;
  if (
    settings.algorithm !== BACKUP_ENCRYPTION_ALGORITHM ||
    settings.keyDerivation !== BACKUP_KEY_DERIVATION ||
    settings.iterations !== BACKUP_KEY_ITERATIONS
  ) throw new Error("Encrypted backup settings are unsupported.");
  if (typeof input.exportedAt !== "string" || !input.exportedAt) throw new Error("Encrypted backup date is missing.");
  const salt = base64ToBytes(settings.salt, "salt");
  const iv = base64ToBytes(settings.iv, "initialization vector");
  const ciphertext = base64ToBytes(input.ciphertext, "ciphertext");
  if (salt.length !== BACKUP_SALT_BYTES || iv.length !== BACKUP_IV_BYTES || ciphertext.length < 17) {
    throw new Error("Encrypted backup cryptographic data has an invalid length.");
  }
  try {
    const key = await deriveBackupKey(passphrase, salt, ["decrypt"]);
    const plaintext = await crypto.subtle.decrypt({ name: BACKUP_ENCRYPTION_ALGORITHM, iv }, key, ciphertext);
    const backup = JSON.parse(new TextDecoder().decode(plaintext)) as unknown;
    if (!isRecord(backup) || backup.exportedAt !== input.exportedAt) throw new Error("Backup date mismatch");
    return await verifyAndMigrateBackup(backup);
  } catch {
    throw new Error("Could not decrypt backup. Check the passphrase and file integrity.");
  }
}

export async function verifyAndMigrateBackup(input: unknown): Promise<Scenario[]> {
  if (!isRecord(input)) throw new Error("Backup must be an object.");
  if (input.version !== CURRENT_BACKUP_VERSION) return migrateBackup(input);
  if (typeof input.exportedAt !== "string" || !input.exportedAt || !isRecord(input.manifest)) {
    throw new Error("Backup integrity information is missing.");
  }
  const manifest = input.manifest;
  const rawScenarios = Array.isArray(input.scenarios) ? input.scenarios : [];
  if (manifest.format !== BACKUP_FORMAT || manifest.checksumAlgorithm !== BACKUP_CHECKSUM_ALGORITHM) {
    throw new Error("Backup format or checksum algorithm is unsupported.");
  }
  if (manifest.scenarioCount !== rawScenarios.length) throw new Error("Backup scenario count does not match its manifest.");
  if (typeof manifest.checksum !== "string") throw new Error("Backup checksum is missing.");
  const checksum = await sha256Hex(checksumInput(input.exportedAt, rawScenarios));
  if (checksum !== manifest.checksum) throw new Error("Backup checksum failed. The file may be incomplete or modified.");
  return migrateBackup(input);
}

export function getBackupHealth(lastExportAt: string | null, now = new Date(), dueAfterDays = 30): BackupHealth {
  if (!lastExportAt) return "missing";
  const exported = new Date(lastExportAt);
  if (!Number.isFinite(exported.getTime())) return "missing";
  return now.getTime() - exported.getTime() > dueAfterDays * 86_400_000 ? "due" : "current";
}
