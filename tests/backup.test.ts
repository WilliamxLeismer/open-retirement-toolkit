import { describe, expect, it } from "vitest";
import {
  BACKUP_CHECKSUM_ALGORITHM,
  BACKUP_ENCRYPTION_ALGORITHM,
  BACKUP_FORMAT,
  BACKUP_KEY_DERIVATION,
  BACKUP_KEY_ITERATIONS,
  createBackup,
  createEncryptedBackup,
  decryptAndVerifyBackup,
  ENCRYPTED_BACKUP_FORMAT,
  getBackupHealth,
  isEncryptedBackup,
  sha256Hex,
  verifyAndMigrateBackup
} from "../src/backup";
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

  it("verifies checksummed backups before migrating older scenarios", async () => {
    const current = makeScenario();
    const { taxBuckets: _taxBuckets, ...olderFields } = current;
    const olderScenario = { ...olderFields, version: 7 };
    const exportedAt = "2026-09-15T12:00:00.000Z";
    const checksum = await sha256Hex(JSON.stringify({ version: CURRENT_BACKUP_VERSION, exportedAt, scenarios: [olderScenario] }));
    const migrated = await verifyAndMigrateBackup({
      version: CURRENT_BACKUP_VERSION,
      exportedAt,
      manifest: { format: BACKUP_FORMAT, scenarioCount: 1, checksumAlgorithm: BACKUP_CHECKSUM_ALGORITHM, checksum },
      scenarios: [olderScenario]
    });
    expect(migrated[0].version).toBe(8);
    expect(migrated[0].taxBuckets.enabled).toBe(false);
  });

  it("classifies backup age without relying on the current clock", () => {
    const now = new Date("2026-09-15T12:00:00.000Z");
    expect(getBackupHealth(null, now)).toBe("missing");
    expect(getBackupHealth("not-a-date", now)).toBe("missing");
    expect(getBackupHealth("2026-09-01T12:00:00.000Z", now)).toBe("current");
    expect(getBackupHealth("2026-07-01T12:00:00.000Z", now)).toBe("due");
  });
});

describe("encrypted backups", () => {
  const passphrase = "correct horse battery staple";

  it("round-trips a verified backup without exposing scenario content", async () => {
    const scenario = makeScenario({ name: "Private plan" });
    const backup = await createEncryptedBackup([scenario], passphrase, "2026-09-15T12:00:00.000Z");
    expect(backup.format).toBe(ENCRYPTED_BACKUP_FORMAT);
    expect(backup.encryption).toMatchObject({
      algorithm: BACKUP_ENCRYPTION_ALGORITHM,
      keyDerivation: BACKUP_KEY_DERIVATION,
      iterations: BACKUP_KEY_ITERATIONS
    });
    expect(backup.encryption.salt).not.toBe(backup.encryption.iv);
    expect(JSON.stringify(backup)).not.toContain("Private plan");
    expect(isEncryptedBackup(backup)).toBe(true);
    await expect(decryptAndVerifyBackup(backup, passphrase)).resolves.toEqual([scenario]);
  });

  it("uses fresh cryptographic values for every export", async () => {
    const scenario = makeScenario();
    const first = await createEncryptedBackup([scenario], passphrase);
    const second = await createEncryptedBackup([scenario], passphrase);
    expect(first.encryption.salt).not.toBe(second.encryption.salt);
    expect(first.encryption.iv).not.toBe(second.encryption.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it("rejects short passphrases", async () => {
    await expect(createEncryptedBackup([makeScenario()], "too short")).rejects.toThrow("at least 12 characters");
  });

  it("rejects an incorrect passphrase and modified ciphertext", async () => {
    const backup = await createEncryptedBackup([makeScenario()], passphrase);
    await expect(decryptAndVerifyBackup(backup, "incorrect passphrase")).rejects.toThrow("Could not decrypt");
    const replacement = backup.ciphertext.endsWith("A") ? "B" : "A";
    const modified = { ...backup, ciphertext: backup.ciphertext.slice(0, -1) + replacement };
    await expect(decryptAndVerifyBackup(modified, passphrase)).rejects.toThrow();
  });

  it("rejects unsupported or malformed encrypted envelopes before key derivation", async () => {
    await expect(decryptAndVerifyBackup({}, passphrase)).rejects.toThrow("not an encrypted");
    await expect(decryptAndVerifyBackup({ format: ENCRYPTED_BACKUP_FORMAT, version: 2 }, passphrase)).rejects.toThrow("version is unsupported");
    const backup = await createEncryptedBackup([makeScenario()], passphrase);
    await expect(decryptAndVerifyBackup({ ...backup, encryption: { ...backup.encryption, algorithm: "AES-CBC" } }, passphrase)).rejects.toThrow("settings are unsupported");
    await expect(decryptAndVerifyBackup({ ...backup, ciphertext: "not base64" }, passphrase)).rejects.toThrow("ciphertext is invalid");
  });
});
