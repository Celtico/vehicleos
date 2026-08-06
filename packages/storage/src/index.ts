/**
 * @vehicleos/storage — almacenamiento local sin dependencias.
 *
 * Usa IndexedDB cuando existe y degrada a memoria en SSR/Node.
 */
import { IdbKeyValueStore, IdbQueue } from "./idb";
import { MemoryKeyValueStore, MemoryQueue } from "./memory";
import type { KeyValueStore, OfflineQueue } from "./types";

export type { KeyValueStore, OfflineQueue } from "./types";
export { MemoryKeyValueStore, MemoryQueue } from "./memory";
export { IdbKeyValueStore, IdbQueue, openDb, KV_STORE, QUEUE_STORE } from "./idb";

const DEFAULT_DB = "vehicleos";

/** ¿Hay IndexedDB disponible en este entorno? */
export function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

/**
 * Crea la cola offline de lotes de telemetría.
 * Persistente (IndexedDB) en navegador; en memoria en SSR/Node.
 */
export function createOfflineQueue(dbName: string = DEFAULT_DB): OfflineQueue {
  return hasIndexedDb() ? new IdbQueue(dbName) : new MemoryQueue();
}

/**
 * Crea el almacén clave-valor de ajustes.
 * Persistente (IndexedDB) en navegador; en memoria en SSR/Node.
 */
export function createKeyValueStore(dbName: string = DEFAULT_DB): KeyValueStore {
  return hasIndexedDb() ? new IdbKeyValueStore(dbName) : new MemoryKeyValueStore();
}
