/**
 * Variables de entorno públicas de la PWA con valores por defecto.
 */
export const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const DEFAULT_WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001/telemetry";

/**
 * Ruta del punto de entrada de socket.io.
 *
 * Detrás de un proxy que sirve la API bajo /api del mismo dominio que el
 * cockpit, socket.io queda en "/api/socket.io". En desarrollo, con el
 * backend en su propio puerto, se deja la estándar.
 */
export const DEFAULT_SOCKET_PATH = process.env.NEXT_PUBLIC_SOCKET_PATH ?? "";

/** Identificador del vehículo demo. */
export const VEHICLE_ID = "sim-001";
