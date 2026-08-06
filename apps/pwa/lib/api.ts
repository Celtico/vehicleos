/**
 * Cliente del backend para el panel web.
 *
 * Todas las llamadas van firmadas con el JWT que se configura en Ajustes:
 * cada coche pertenece a un usuario y el backend responde 404 (no 403) ante
 * un vehículo ajeno, para no filtrar si existe.
 */
import type { DiagnosticTroubleCode, GeoPoint, Trip, VehicleAlert } from "@vehicleos/shared";

/** Vehículo tal como lo devuelve el backend. */
export interface Vehicle {
  id: string;
  ownerId: string;
  name: string;
  make: string;
  model: string;
  year: number;
  vin?: string | null;
  plate?: string | null;
  createdAt: string;
}

/** Última muestra conocida de un vehículo. */
export interface LastSample {
  timestamp: number;
  speed: number;
  rpm: number;
  coolantTemp: number;
  batteryVoltage: number;
  fuelLevel: number;
  location?: GeoPoint;
}

/** Estado consolidado que pinta cada tarjeta del panel. */
export interface VehicleStatus {
  vehicleId: string;
  lastSample: LastSample | null;
  activeDtc: DiagnosticTroubleCode[];
  pendingAlerts: VehicleAlert[];
}

/** Agregados históricos de un vehículo. */
export interface VehicleStats {
  vehicleId: string;
  sampleCount: number;
  distanceKm: number;
  avgSpeed: number;
  maxSpeed: number;
  avgConsumption: number;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  apiUrl: string,
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  if (!token) throw new ApiError(401, "Falta el token de acceso (configúralo en Ajustes)");

  const res = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const detalle =
      res.status === 401
        ? "Token inválido o caducado"
        : res.status === 404
          ? "No encontrado"
          : `El backend respondió ${res.status}`;
    throw new ApiError(res.status, detalle);
  }
  return (await res.json()) as T;
}

export const api = {
  vehicles: (apiUrl: string, token: string) => request<Vehicle[]>(apiUrl, token, "/vehicles"),

  status: (apiUrl: string, token: string, id: string) =>
    request<VehicleStatus>(apiUrl, token, `/vehicles/${id}/status`),

  stats: (apiUrl: string, token: string, id: string) =>
    request<VehicleStats>(apiUrl, token, `/vehicles/${id}/stats`),

  trips: (apiUrl: string, token: string, id: string) =>
    request<Trip[]>(apiUrl, token, `/vehicles/${id}/trips`),

  alerts: (apiUrl: string, token: string) => request<VehicleAlert[]>(apiUrl, token, "/alerts"),

  ackAlert: (apiUrl: string, token: string, id: string) =>
    request<VehicleAlert>(apiUrl, token, `/alerts/${id}/ack`, { method: "POST" }),
};
