/**
 * Variables de entorno públicas de la PWA con valores por defecto.
 */
export const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const DEFAULT_WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001/telemetry";

/** Identificador del vehículo demo. */
export const VEHICLE_ID = "sim-001";
