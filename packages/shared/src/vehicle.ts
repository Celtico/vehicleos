/**
 * Tipos de dominio del vehículo.
 *
 * Este módulo es la fuente de verdad del modelo de datos de VehicleOS.
 * Todos los paquetes (SDK, simulador, PWA, backend, bridge) usan estos tipos.
 */

/** Estado de salud de un subsistema del vehículo. */
export type SystemHealth = "ok" | "warning" | "error" | "unknown";

/** Estado de los subsistemas críticos monitorizados en el dashboard. */
export interface VehicleSystems {
  engine: SystemHealth;
  abs: SystemHealth;
  esp: SystemHealth;
  airbag: SystemHealth;
}

/** Posición GPS. */
export interface GeoPoint {
  /** Latitud en grados decimales. */
  lat: number;
  /** Longitud en grados decimales. */
  lon: number;
  /** Rumbo en grados (0-360, opcional). */
  heading?: number;
  /** Altitud en metros (opcional). */
  altitude?: number;
}

/**
 * Instantánea de telemetría en tiempo real del vehículo.
 * Es la unidad que fluye por `VehicleProvider.live()`, por el WebSocket
 * de telemetría y por el bridge Android.
 */
export interface VehicleTelemetry {
  /** Marca de tiempo Unix en milisegundos. */
  timestamp: number;
  /** Velocidad en km/h. */
  speed: number;
  /** Régimen del motor en revoluciones por minuto. */
  rpm: number;
  /** Temperatura del refrigerante en °C. */
  coolantTemp: number;
  /** Tensión de la batería / sistema de carga en voltios. */
  batteryVoltage: number;
  /** Presión de sobrealimentación (turbo) en bar relativos. */
  turboPressure: number;
  /** Nivel de combustible en porcentaje (0-100). */
  fuelLevel: number;
  /** Carga del motor en porcentaje (0-100). */
  engineLoad: number;
  /** Posición del acelerador en porcentaje (0-100). */
  throttle: number;
  /** Consumo instantáneo en litros/hora. */
  fuelRate: number;
  /** Odómetro en kilómetros. */
  odometer: number;
  /** ¿Está el motor en marcha? */
  engineRunning: boolean;
  /** Posición GPS si está disponible. */
  location?: GeoPoint;
  /** Estado de los subsistemas. */
  systems: VehicleSystems;
}

/** Categoría de un código de avería según su primera letra. */
export type DtcCategory = "powertrain" | "chassis" | "body" | "network";

/** Código de avería (Diagnostic Trouble Code, modo 03/07/0A de OBD-II). */
export interface DiagnosticTroubleCode {
  /** Código normalizado, p. ej. "P0401". */
  code: string;
  /** stored = confirmado, pending = pendiente, permanent = permanente. */
  status: "stored" | "pending" | "permanent";
  /** Descripción legible si se conoce. */
  description?: string;
}

/** Estado de la conexión con el vehículo. */
export type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

/** Viaje registrado (para telemetría e historial). */
export interface Trip {
  id: string;
  vehicleId: string;
  startedAt: number;
  endedAt?: number;
  distanceKm: number;
  /** Consumo medio en L/100km. */
  avgConsumption: number;
  maxSpeed: number;
  avgSpeed: number;
  /** Ruta recorrida (muestreada). */
  path: GeoPoint[];
}

/** Alerta generada por el backend (p. ej. sobretemperatura, DTC nuevo). */
export interface VehicleAlert {
  id: string;
  vehicleId: string;
  createdAt: number;
  severity: "info" | "warning" | "critical";
  kind: "dtc" | "overheat" | "low-battery" | "low-fuel" | "maintenance" | "custom";
  message: string;
  acknowledged: boolean;
}
