/**
 * Implementaciones en memoria: fallback cuando no existe `indexedDB`
 * (SSR, tests en Node, navegadores muy antiguos). No persisten entre
 * recargas, pero mantienen el mismo contrato asíncrono.
 */
import type { TelemetryBatch } from "@vehicleos/shared";
import type { KeyValueStore, OfflineQueue } from "./types";

export class MemoryQueue implements OfflineQueue {
  private items: TelemetryBatch[] = [];

  async push(batch: TelemetryBatch): Promise<void> {
    this.items.push(batch);
  }

  async drain(max = Number.POSITIVE_INFINITY): Promise<TelemetryBatch[]> {
    const n = Math.max(0, Math.min(this.items.length, max));
    return this.items.splice(0, n);
  }

  async size(): Promise<number> {
    return this.items.length;
  }

  async clear(): Promise<void> {
    this.items = [];
  }
}

export class MemoryKeyValueStore implements KeyValueStore {
  private map = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.map.get(key) as T | undefined;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.map.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.map.delete(key);
  }
}
