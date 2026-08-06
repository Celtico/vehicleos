/**
 * Definición de PIDs OBD-II (modo 01) usados por VehicleOS.
 *
 * Cada PID incluye su fórmula de conversión estándar SAE J1979.
 * El bridge Android y los futuros providers (CAN, ThinkDiag, XTool)
 * comparten estas definiciones para no duplicar fórmulas.
 */

export interface PidDefinition {
  /** Modo OBD-II (0x01 = datos en tiempo real). */
  mode: number;
  /** Identificador del PID. */
  pid: number;
  /** Nombre estable usado como clave en el bridge. */
  key: string;
  /** Descripción legible. */
  name: string;
  /** Unidad del valor ya convertido. */
  unit: string;
  /** Número de bytes de datos que devuelve la ECU. */
  bytes: number;
  /** Convierte los bytes crudos de la ECU al valor físico. */
  parse: (data: number[]) => number;
}

const A = (d: number[]) => d[0] ?? 0;
const B = (d: number[]) => d[1] ?? 0;

/** Tabla de PIDs soportados, indexada por clave estable. */
export const PIDS = {
  ENGINE_LOAD: {
    mode: 0x01,
    pid: 0x04,
    key: "ENGINE_LOAD",
    name: "Carga del motor",
    unit: "%",
    bytes: 1,
    parse: (d) => (A(d) * 100) / 255,
  },
  COOLANT_TEMP: {
    mode: 0x01,
    pid: 0x05,
    key: "COOLANT_TEMP",
    name: "Temperatura del refrigerante",
    unit: "°C",
    bytes: 1,
    parse: (d) => A(d) - 40,
  },
  INTAKE_MAP: {
    mode: 0x01,
    pid: 0x0b,
    key: "INTAKE_MAP",
    name: "Presión absoluta del colector",
    unit: "kPa",
    bytes: 1,
    parse: (d) => A(d),
  },
  RPM: {
    mode: 0x01,
    pid: 0x0c,
    key: "RPM",
    name: "Régimen del motor",
    unit: "rpm",
    bytes: 2,
    parse: (d) => (A(d) * 256 + B(d)) / 4,
  },
  SPEED: {
    mode: 0x01,
    pid: 0x0d,
    key: "SPEED",
    name: "Velocidad del vehículo",
    unit: "km/h",
    bytes: 1,
    parse: (d) => A(d),
  },
  INTAKE_TEMP: {
    mode: 0x01,
    pid: 0x0f,
    key: "INTAKE_TEMP",
    name: "Temperatura de admisión",
    unit: "°C",
    bytes: 1,
    parse: (d) => A(d) - 40,
  },
  THROTTLE: {
    mode: 0x01,
    pid: 0x11,
    key: "THROTTLE",
    name: "Posición del acelerador",
    unit: "%",
    bytes: 1,
    parse: (d) => (A(d) * 100) / 255,
  },
  FUEL_LEVEL: {
    mode: 0x01,
    pid: 0x2f,
    key: "FUEL_LEVEL",
    name: "Nivel de combustible",
    unit: "%",
    bytes: 1,
    parse: (d) => (A(d) * 100) / 255,
  },
  BAROMETRIC: {
    mode: 0x01,
    pid: 0x33,
    key: "BAROMETRIC",
    name: "Presión barométrica",
    unit: "kPa",
    bytes: 1,
    parse: (d) => A(d),
  },
  CONTROL_MODULE_VOLTAGE: {
    mode: 0x01,
    pid: 0x42,
    key: "CONTROL_MODULE_VOLTAGE",
    name: "Tensión del módulo de control",
    unit: "V",
    bytes: 2,
    parse: (d) => (A(d) * 256 + B(d)) / 1000,
  },
  FUEL_RATE: {
    mode: 0x01,
    pid: 0x5e,
    key: "FUEL_RATE",
    name: "Consumo instantáneo",
    unit: "L/h",
    bytes: 2,
    parse: (d) => (A(d) * 256 + B(d)) / 20,
  },
} as const satisfies Record<string, PidDefinition>;

export type PidKey = keyof typeof PIDS;

/**
 * Presión de turbo relativa (boost) en bar a partir de la presión
 * absoluta del colector y la barométrica: boost = MAP − baro.
 * Devuelve 0 como mínimo (en vacío no hay sobrepresión).
 */
export function boostFromMap(mapKpa: number, baroKpa = 101): number {
  return Math.max(0, (mapKpa - baroKpa) / 100);
}
