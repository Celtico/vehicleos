/** Conversión entre filas de Prisma y los contratos de @vehicleos/shared. */
import type { TelemetrySample } from "@vehicleos/shared";
import type { TelemetrySample as TelemetrySampleRow } from "@prisma/client";

/** Convierte una fila de BD en el contrato TelemetrySample (timestamps en ms). */
export function rowToSample(row: TelemetrySampleRow): TelemetrySample {
  return {
    timestamp: row.timestamp.getTime(),
    speed: row.speed,
    rpm: row.rpm,
    coolantTemp: row.coolantTemp,
    batteryVoltage: row.batteryVoltage,
    fuelLevel: row.fuelLevel,
    ...(row.lat !== null && row.lon !== null
      ? { location: { lat: row.lat, lon: row.lon } }
      : {}),
  };
}
