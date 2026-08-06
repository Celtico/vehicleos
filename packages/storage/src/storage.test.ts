/**
 * Tests del fallback en memoria (en Node no hay indexedDB).
 */
import { describe, expect, it } from "vitest";
import type { TelemetryBatch } from "@vehicleos/shared";
import {
  createKeyValueStore,
  createOfflineQueue,
  hasIndexedDb,
  MemoryKeyValueStore,
  MemoryQueue,
} from "./index";

function batch(n: number): TelemetryBatch {
  return {
    vehicleId: "sim-001",
    samples: [
      {
        timestamp: n,
        speed: n,
        rpm: n * 100,
        coolantTemp: 90,
        batteryVoltage: 14.2,
        fuelLevel: 50,
      },
    ],
  };
}

describe("fallback en memoria", () => {
  it("en Node no hay indexedDB y las fábricas degradan a memoria", () => {
    expect(hasIndexedDb()).toBe(false);
    expect(createOfflineQueue()).toBeInstanceOf(MemoryQueue);
    expect(createKeyValueStore()).toBeInstanceOf(MemoryKeyValueStore);
  });

  it("la cola es FIFO: push y drain conservan el orden", async () => {
    const queue = new MemoryQueue();
    await queue.push(batch(1));
    await queue.push(batch(2));
    await queue.push(batch(3));
    expect(await queue.size()).toBe(3);

    const drained = await queue.drain();
    expect(drained.map((b) => b.samples[0]?.timestamp)).toEqual([1, 2, 3]);
    expect(await queue.size()).toBe(0);
  });

  it("drain(max) extrae solo los primeros lotes", async () => {
    const queue = new MemoryQueue();
    await queue.push(batch(1));
    await queue.push(batch(2));
    await queue.push(batch(3));

    const first = await queue.drain(2);
    expect(first).toHaveLength(2);
    expect(first[0]?.samples[0]?.timestamp).toBe(1);
    expect(await queue.size()).toBe(1);

    const rest = await queue.drain();
    expect(rest[0]?.samples[0]?.timestamp).toBe(3);
  });

  it("clear vacía la cola", async () => {
    const queue = new MemoryQueue();
    await queue.push(batch(1));
    await queue.clear();
    expect(await queue.size()).toBe(0);
    expect(await queue.drain()).toEqual([]);
  });

  it("el clave-valor guarda, lee y borra", async () => {
    const kv = new MemoryKeyValueStore();
    expect(await kv.get("wsUrl")).toBeUndefined();

    await kv.set("wsUrl", "ws://localhost:3001/telemetry");
    expect(await kv.get<string>("wsUrl")).toBe("ws://localhost:3001/telemetry");

    await kv.set("opciones", { telemetria: true, lotes: 5 });
    expect(await kv.get("opciones")).toEqual({ telemetria: true, lotes: 5 });

    await kv.remove("wsUrl");
    expect(await kv.get("wsUrl")).toBeUndefined();
  });
});
