/**
 * Implementaciones sobre IndexedDB nativo (sin dependencias).
 *
 * Una única base "vehicleos" con dos object stores:
 *  - "telemetry-queue": cola FIFO (clave autoincremental).
 *  - "settings": clave-valor de ajustes.
 */
import type { TelemetryBatch } from "@vehicleos/shared";
import type { KeyValueStore, OfflineQueue } from "./types";

export const QUEUE_STORE = "telemetry-queue";
export const KV_STORE = "settings";
const DB_VERSION = 1;

/** Promifica una IDBRequest. */
function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Error de IndexedDB"));
  });
}

/** Espera a que termine una transacción. */
function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("Transacción abortada"));
    tx.onerror = () => reject(tx.error ?? new Error("Error de transacción"));
  });
}

const dbCache = new Map<string, Promise<IDBDatabase>>();

/** Abre (y memoiza) la base de datos, creando los stores si hace falta. */
export function openDb(name: string): Promise<IDBDatabase> {
  let cached = dbCache.get(name);
  if (!cached) {
    cached = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(name, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(QUEUE_STORE)) {
          db.createObjectStore(QUEUE_STORE, { autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(KV_STORE)) {
          db.createObjectStore(KV_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("No se pudo abrir IndexedDB"));
    });
    dbCache.set(name, cached);
  }
  return cached;
}

export class IdbQueue implements OfflineQueue {
  constructor(private readonly dbName: string) {}

  async push(batch: TelemetryBatch): Promise<void> {
    const db = await openDb(this.dbName);
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    tx.objectStore(QUEUE_STORE).add(batch);
    await txDone(tx);
  }

  async drain(max = Number.POSITIVE_INFINITY): Promise<TelemetryBatch[]> {
    const db = await openDb(this.dbName);
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    const store = tx.objectStore(QUEUE_STORE);
    const out: TelemetryBatch[] = [];
    await new Promise<void>((resolve, reject) => {
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor || out.length >= max) {
          resolve();
          return;
        }
        out.push(cursor.value as TelemetryBatch);
        cursor.delete();
        cursor.continue();
      };
      cursorReq.onerror = () => reject(cursorReq.error ?? new Error("Error del cursor"));
    });
    await txDone(tx);
    return out;
  }

  async size(): Promise<number> {
    const db = await openDb(this.dbName);
    const tx = db.transaction(QUEUE_STORE, "readonly");
    return requestToPromise(tx.objectStore(QUEUE_STORE).count());
  }

  async clear(): Promise<void> {
    const db = await openDb(this.dbName);
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    tx.objectStore(QUEUE_STORE).clear();
    await txDone(tx);
  }
}

export class IdbKeyValueStore implements KeyValueStore {
  constructor(private readonly dbName: string) {}

  async get<T>(key: string): Promise<T | undefined> {
    const db = await openDb(this.dbName);
    const tx = db.transaction(KV_STORE, "readonly");
    const value = await requestToPromise(tx.objectStore(KV_STORE).get(key));
    return value as T | undefined;
  }

  async set<T>(key: string, value: T): Promise<void> {
    const db = await openDb(this.dbName);
    const tx = db.transaction(KV_STORE, "readwrite");
    tx.objectStore(KV_STORE).put(value, key);
    await txDone(tx);
  }

  async remove(key: string): Promise<void> {
    const db = await openDb(this.dbName);
    const tx = db.transaction(KV_STORE, "readwrite");
    tx.objectStore(KV_STORE).delete(key);
    await txDone(tx);
  }
}
