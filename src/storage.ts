import type { Scenario } from "./domain";
import { migrateScenario } from "./scenario-schema";

const DB_NAME = "open-retirement-toolkit";
const STORE = "scenarios";
const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

export async function saveScenario(scenario: Scenario): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(migrateScenario(scenario));
    tx.oncomplete = () => resolve();
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
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
