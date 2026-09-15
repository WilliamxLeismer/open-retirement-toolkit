import type { Scenario } from "./domain";
import { MAX_RECOVERY_POINTS, newestRecoveryPoints, shouldCreateRecoveryPoint, type RecoveryPoint } from "./recovery";
import { migrateScenario } from "./scenario-schema";

const DB_NAME = "open-retirement-toolkit";
const STORE = "scenarios";
const RECOVERY_STORE = "recovery-points";
const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 2);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" });
    if (!request.result.objectStoreNames.contains(RECOVERY_STORE)) {
      const recovery = request.result.createObjectStore(RECOVERY_STORE, { keyPath: "id" });
      recovery.createIndex("scenarioId", "scenarioId", { unique: false });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

export async function saveScenario(scenario: Scenario): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE, RECOVERY_STORE], "readwrite");
    const scenarios = tx.objectStore(STORE);
    const recovery = tx.objectStore(RECOVERY_STORE);
    const migrated = migrateScenario(scenario);
    const previousRequest = scenarios.get(migrated.id);
    const pointsRequest = recovery.index("scenarioId").getAll(IDBKeyRange.only(migrated.id));
    let previous: Scenario | undefined;
    let points: RecoveryPoint[] = [];
    let captured = false;
    const capture = () => {
      if (captured || previousRequest.readyState !== "done" || pointsRequest.readyState !== "done") return;
      captured = true;
      if (!previous || !shouldCreateRecoveryPoint(previous, migrated, points[0])) return;
      const savedAt = new Date().toISOString();
      recovery.put({ id: `${migrated.id}:${savedAt}`, scenarioId: migrated.id, savedAt, scenario: previous } satisfies RecoveryPoint);
      for (const stale of points.slice(MAX_RECOVERY_POINTS - 1)) recovery.delete(stale.id);
    };
    previousRequest.onsuccess = () => {
      previous = previousRequest.result ? migrateScenario(previousRequest.result) : undefined;
      capture();
    };
    pointsRequest.onsuccess = () => {
      points = newestRecoveryPoints(pointsRequest.result as RecoveryPoint[]);
      capture();
    };
    tx.objectStore(STORE).put(migrated);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function listScenarios(): Promise<Scenario[]> {
  const db = await openDb();
  const result = await new Promise<Scenario[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const request = store.getAll();
    let migrated: Scenario[] = [];
    request.onsuccess = () => {
      try {
        migrated = request.result.map(migrateScenario);
        migrated.forEach(scenario => store.put(scenario));
      } catch (error) {
        reject(error);
        tx.abort();
      }
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => resolve(migrated);
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return result.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function deleteScenario(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE, RECOVERY_STORE], "readwrite");
    tx.objectStore(STORE).delete(id);
    const cursorRequest = tx.objectStore(RECOVERY_STORE).index("scenarioId").openKeyCursor(IDBKeyRange.only(id));
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (cursor) { tx.objectStore(RECOVERY_STORE).delete(cursor.primaryKey); cursor.continue(); }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function listRecoveryPoints(scenarioId: string): Promise<RecoveryPoint[]> {
  const db = await openDb();
  const result = await new Promise<RecoveryPoint[]>((resolve, reject) => {
    const tx = db.transaction(RECOVERY_STORE, "readonly");
    const request = tx.objectStore(RECOVERY_STORE).index("scenarioId").getAll(IDBKeyRange.only(scenarioId));
    request.onsuccess = () => resolve(newestRecoveryPoints(request.result as RecoveryPoint[]));
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
}

export async function saveRecoveryPoint(scenario: Scenario): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(RECOVERY_STORE, "readwrite");
    const store = tx.objectStore(RECOVERY_STORE);
    const request = store.index("scenarioId").getAll(IDBKeyRange.only(scenario.id));
    request.onsuccess = () => {
      const points = newestRecoveryPoints(request.result as RecoveryPoint[]);
      const savedAt = new Date().toISOString();
      store.put({ id: `${scenario.id}:${savedAt}`, scenarioId: scenario.id, savedAt, scenario: migrateScenario(scenario) } satisfies RecoveryPoint);
      for (const stale of points.slice(MAX_RECOVERY_POINTS - 1)) store.delete(stale.id);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
