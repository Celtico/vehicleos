/**
 * Contratos de la telemetría cliente → backend.
 */
import type { DiagnosticTroubleCode, GeoPoint, VehicleTelemetry } from "./vehicle";

/** Muestra reducida que se envía al servidor (no toda la telemetría cruda). */
export interface TelemetrySample {
  timestamp: number;
  speed: number;
  rpm: number;
  coolantTemp: number;
  batteryVoltage: number;
  fuelLevel: number;
  location?: GeoPoint;
}

/** Lote de muestras enviado por WebSocket (nunca polling). */
export interface TelemetryBatch {
  vehicleId: string;
  samples: TelemetrySample[];
  /** DTCs activos en el momento del envío, si han cambiado. */
  dtc?: DiagnosticTroubleCode[];
}

/** Convierte una instantánea completa en la muestra que viaja al servidor. */
export function toTelemetrySample(t: VehicleTelemetry): TelemetrySample {
  return {
    timestamp: t.timestamp,
    speed: t.speed,
    rpm: t.rpm,
    coolantTemp: t.coolantTemp,
    batteryVoltage: t.batteryVoltage,
    fuelLevel: t.fuelLevel,
    location: t.location,
  };
}

/** Mensajes del WebSocket de telemetría (namespace /telemetry del backend). */
export type TelemetryClientMessage =
  | { type: "batch"; payload: TelemetryBatch }
  | { type: "trip-start"; payload: { vehicleId: string; startedAt: number } }
  | { type: "trip-end"; payload: { vehicleId: string; endedAt: number } };

export type TelemetryServerMessage =
  | { type: "ack"; payload: { received: number } }
  | { type: "alert"; payload: { vehicleId: string; message: string } };
