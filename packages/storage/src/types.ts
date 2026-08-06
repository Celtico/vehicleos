/**
 * Contratos del almacenamiento local de VehicleOS.
 */
import type { TelemetryBatch } from "@vehicleos/shared";

/** Cola FIFO persistente de lotes de telemetría pendientes de enviar. */
export interface OfflineQueue {
  /** Encola un lote al final. */
  push(batch: TelemetryBatch): Promise<void>;
  /**
   * Extrae (y elimina) hasta `max` lotes por orden de llegada.
   * Sin argumento, vacía la cola completa.
   */
  drain(max?: number): Promise<TelemetryBatch[]>;
  /** Número de lotes pendientes. */
  size(): Promise<number>;
  /** Vacía la cola sin devolver nada. */
  clear(): Promise<void>;
}

/** Almacén clave-valor para ajustes de la aplicación. */
export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}
