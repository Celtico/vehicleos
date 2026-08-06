/**
 * Mapeo de códigos de avería a piezas físicas del coche.
 *
 * Es lo que permite que el modelo del vehículo resalte la esquina afectada
 * en lugar de limitarse a listar códigos: los DTC del chasis ya identifican
 * la rueda concreta (C0035 = sensor de velocidad de rueda delantera
 * izquierda), así que la información está ahí, solo hay que traducirla.
 */
import { dtcCategory } from "@vehicleos/vehicle-protocol";
import type { DiagnosticTroubleCode } from "@vehicleos/shared";

/** Piezas direccionables del modelo del vehículo (ver @vehicleos/ui). */
export type VehiclePartId =
  | "engine"
  | "body"
  | "wheel-fl"
  | "wheel-fr"
  | "wheel-rl"
  | "wheel-rr"
  | "door-fl"
  | "door-fr"
  | "door-rl"
  | "door-rr";

export type PartSeverity = "ok" | "info" | "warning" | "error";

/**
 * Códigos de sensor de velocidad de rueda del grupo C0035-C0050.
 *
 * La norma SAE J2012 asigna estos códigos por esquina, en el orden
 * habitual: delantera izquierda, delantera derecha, trasera izquierda,
 * trasera derecha.
 */
const WHEEL_SPEED_CODES: Record<string, VehiclePartId> = {
  C0035: "wheel-fl",
  C0036: "wheel-fl",
  C0037: "wheel-fl",
  C0040: "wheel-fr",
  C0041: "wheel-fr",
  C0042: "wheel-fr",
  C0045: "wheel-rl",
  C0046: "wheel-rl",
  C0047: "wheel-rl",
  C0050: "wheel-rr",
  C0051: "wheel-rr",
  C0052: "wheel-rr",
};

/** Códigos concretos con pieza conocida más allá del grupo de ruedas. */
const CODE_TO_PARTS: Record<string, VehiclePartId[]> = {
  // Motor y gestión: todo lo que se ve en el vano motor.
  P0217: ["engine"],
  P0128: ["engine"],
  P0299: ["engine"],
  P2263: ["engine"],
  P0401: ["engine"],
  P0402: ["engine"],
  P0403: ["engine"],
  P0300: ["engine"],
  P0171: ["engine"],
  P0172: ["engine"],
  P0420: ["engine"],
  P0562: ["engine"],
  P0563: ["engine"],
  P0380: ["engine"], // calentadores: típico de diésel
  P0088: ["engine"], // presión de raíl demasiado alta
  P0093: ["engine"], // fuga grande en el sistema de combustible
  // Estabilidad: afecta al conjunto del chasis, se marcan las cuatro ruedas.
  C1234: ["wheel-fl", "wheel-fr", "wheel-rl", "wheel-rr"],
  // Airbag y carrocería.
  B0001: ["body"],
  B0010: ["body"],
  // Comunicación entre módulos.
  U0100: ["engine", "body"],
  U0121: ["wheel-fl", "wheel-fr", "wheel-rl", "wheel-rr"],
};

/** Severidad visual según el estado del código. */
function severityOf(dtc: DiagnosticTroubleCode): PartSeverity {
  return dtc.status === "pending" ? "warning" : "error";
}

/** Piezas afectadas por un código concreto. */
export function partsForCode(code: string): VehiclePartId[] {
  const normalized = code.trim().toUpperCase();

  const wheel = WHEEL_SPEED_CODES[normalized];
  if (wheel) return [wheel];

  const known = CODE_TO_PARTS[normalized];
  if (known) return known;

  // Sin mapeo concreto: se cae a la categoría del código.
  switch (dtcCategory(normalized)) {
    case "powertrain":
      return ["engine"];
    case "chassis":
      // Chasis sin rueda identificable: afecta al conjunto del vehículo.
      return ["body"];
    case "body":
      return ["body"];
    case "network":
      return ["body"];
  }
}

/**
 * Traduce la lista de averías activas al mapa de piezas resaltadas.
 * Si una pieza acumula varios códigos, gana la severidad más alta.
 */
export function partsFromDtc(
  codes: DiagnosticTroubleCode[],
): Partial<Record<VehiclePartId, PartSeverity>> {
  const rank: Record<PartSeverity, number> = { ok: 0, info: 1, warning: 2, error: 3 };
  const result: Partial<Record<VehiclePartId, PartSeverity>> = {};

  for (const dtc of codes) {
    const severity = severityOf(dtc);
    for (const part of partsForCode(dtc.code)) {
      const current = result[part];
      if (!current || rank[severity] > rank[current]) result[part] = severity;
    }
  }
  return result;
}

/** Nombre legible de una pieza, para etiquetas y lectores de pantalla. */
export const PART_LABELS: Record<VehiclePartId, string> = {
  engine: "Motor",
  body: "Carrocería y sistemas",
  "wheel-fl": "Rueda delantera izquierda",
  "wheel-fr": "Rueda delantera derecha",
  "wheel-rl": "Rueda trasera izquierda",
  "wheel-rr": "Rueda trasera derecha",
  "door-fl": "Puerta delantera izquierda",
  "door-fr": "Puerta delantera derecha",
  "door-rl": "Puerta trasera izquierda",
  "door-rr": "Puerta trasera derecha",
};
