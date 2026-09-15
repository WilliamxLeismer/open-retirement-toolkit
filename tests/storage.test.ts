import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { deleteScenario, listRecoveryPoints, listScenarios, saveRecoveryPoint, saveScenario } from "../src/storage";
import { makeScenario } from "./fixtures";

const resetDatabase = () => new Promise<void>((resolve, reject) => {
  const request = indexedDB.deleteDatabase("open-retirement-toolkit");
  request.onsuccess = () => resolve();
  request.onerror = () => reject(request.error);
});

const createLegacyDatabase = (scenario: ReturnType<typeof makeScenario>) => new Promise<void>((resolve, reject) => {
  const request = indexedDB.open("open-retirement-toolkit", 1);
  request.onupgradeneeded = () => request.result.createObjectStore("scenarios", { keyPath: "id" }).put(scenario);
  request.onsuccess = () => { request.result.close(); resolve(); };
  request.onerror = () => reject(request.error);
});

describe("IndexedDB scenario recovery", () => {
  beforeEach(resetDatabase);

  it("saves scenarios and snapshots the prior meaningful version", async () => {
    const original = makeScenario();
    await saveScenario(original);
    await saveScenario({ ...original, startingBalance: 125000, updatedAt: "2026-09-15T12:00:00.000Z" });

    expect((await listScenarios())[0].startingBalance).toBe(125000);
    const points = await listRecoveryPoints(original.id);
    expect(points).toHaveLength(1);
    expect(points[0].scenario.startingBalance).toBe(100000);
  });

  it("upgrades the original scenario-only database without losing data", async () => {
    const original = makeScenario();
    await createLegacyDatabase(original);
    expect((await listScenarios())[0]).toEqual(original);
    await saveScenario({ ...original, startingBalance: 125000 });
    expect(await listRecoveryPoints(original.id)).toHaveLength(1);
  });

  it("does not consume recovery slots for timestamp-only or rapid saves", async () => {
    const original = makeScenario();
    await saveScenario(original);
    await saveScenario({ ...original, updatedAt: "2026-09-15T12:00:00.000Z" });
    expect(await listRecoveryPoints(original.id)).toHaveLength(0);

    await saveScenario({ ...original, startingBalance: 125000 });
    await saveScenario({ ...original, startingBalance: 150000 });
    expect(await listRecoveryPoints(original.id)).toHaveLength(1);
  });

  it("creates a forced recovery point before restoration", async () => {
    const current = makeScenario({ startingBalance: 150000 });
    await saveScenario(current);
    await saveRecoveryPoint(current);
    expect((await listRecoveryPoints(current.id))[0].scenario.startingBalance).toBe(150000);
  });

  it("removes a scenario and its private recovery history", async () => {
    const scenario = makeScenario();
    await saveScenario(scenario);
    await saveRecoveryPoint(scenario);
    await deleteScenario(scenario.id);
    expect(await listScenarios()).toEqual([]);
    expect(await listRecoveryPoints(scenario.id)).toEqual([]);
  });
});
