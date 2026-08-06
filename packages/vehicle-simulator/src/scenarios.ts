/**
 * Escenarios de simulación.
 *
 * Un escenario modifica el comportamiento del motor de simulación:
 * perfil de conducción objetivo, fallos inyectados y DTCs asociados.
 */
import type { DiagnosticTroubleCode, SystemHealth } from "@vehicleos/shared";

export type ScenarioId =
  | "idle" // motor al ralentí
  | "cold-start" // arranque en frío
  | "city" // conducción urbana (aceleraciones y frenadas)
  | "highway" // autopista, velocidad sostenida
  | "hard-braking" // frenada fuerte
  | "overheat" // motor sobrecalentado
  | "cold-engine" // termostato averiado, nunca llega a temperatura
  | "emergency" // modo emergencia (limp mode)
  | "abs-fault" // ABS averiado
  | "esp-fault" // ESP averiado
  | "battery-fault"; // fallo del alternador

export interface ScenarioDefinition {
  id: ScenarioId;
  name: string;
  description: string;
  /**
   * Velocidad objetivo (km/h) en función del tiempo de escenario (s).
   * El conductor virtual persigue este perfil.
   */
  targetSpeed: (t: number) => number;
  /** Temperatura de refrigerante hacia la que converge el motor (°C). */
  coolantTarget?: number;
  /** Tensión de batería con motor en marcha (V). Por defecto 14.2. */
  runningVoltage?: number;
  /** DTCs que inyecta el escenario. */
  dtc?: DiagnosticTroubleCode[];
  /** Estado forzado de subsistemas. */
  systems?: Partial<Record<"engine" | "abs" | "esp" | "airbag", SystemHealth>>;
  /** Límites del modo emergencia. */
  limits?: { maxRpm?: number; maxSpeed?: number };
}

/** Perfil urbano: ciclos de aceleración, crucero y parada (~90 s de ciclo). */
const cityProfile = (t: number): number => {
  const cycle = t % 90;
  if (cycle < 15) return (cycle / 15) * 50; // acelera a 50
  if (cycle < 40) return 50; // crucero
  if (cycle < 50) return 50 - ((cycle - 40) / 10) * 50; // frena a 0
  if (cycle < 60) return 0; // semáforo
  if (cycle < 75) return ((cycle - 60) / 15) * 30; // arranca a 30
  return 30;
};

export const SCENARIOS: Record<ScenarioId, ScenarioDefinition> = {
  idle: {
    id: "idle",
    name: "Ralentí",
    description: "Motor en marcha, vehículo parado.",
    targetSpeed: () => 0,
  },
  "cold-start": {
    id: "cold-start",
    name: "Arranque en frío",
    description: "Arranque a 5 °C con ralentí elevado hasta calentar.",
    targetSpeed: () => 0,
    coolantTarget: 90,
  },
  city: {
    id: "city",
    name: "Ciudad",
    description: "Conducción urbana con aceleraciones, frenadas y semáforos.",
    targetSpeed: cityProfile,
  },
  highway: {
    id: "highway",
    name: "Autopista",
    description: "Incorporación y crucero sostenido a 120 km/h.",
    targetSpeed: (t) => Math.min(120, t * 4),
  },
  "hard-braking": {
    id: "hard-braking",
    name: "Frenada fuerte",
    description: "Acelera a 100 km/h y frena a fondo repetidamente.",
    targetSpeed: (t) => (t % 30 < 20 ? Math.min(100, (t % 30) * 8) : 0),
  },
  overheat: {
    id: "overheat",
    name: "Motor caliente",
    description: "Fallo de refrigeración: la temperatura sube hasta 118 °C.",
    targetSpeed: cityProfile,
    coolantTarget: 118,
    dtc: [{ code: "P0217", status: "stored", description: "Sobretemperatura del motor" }],
    systems: { engine: "error" },
  },
  "cold-engine": {
    id: "cold-engine",
    name: "Motor frío",
    description: "Termostato abierto: el motor no alcanza temperatura de servicio.",
    targetSpeed: cityProfile,
    coolantTarget: 62,
    dtc: [
      {
        code: "P0128",
        status: "stored",
        description: "Temperatura de refrigerante por debajo de la de regulación",
      },
    ],
    systems: { engine: "warning" },
  },
  emergency: {
    id: "emergency",
    name: "Modo emergencia",
    description: "Limp mode: potencia limitada, rpm y velocidad restringidas.",
    targetSpeed: (t) => Math.min(60, t * 2),
    dtc: [
      {
        code: "P0299",
        status: "stored",
        description: "Presión de sobrealimentación insuficiente",
      },
      { code: "P2263", status: "pending", description: "Rendimiento del sistema turbo" },
    ],
    systems: { engine: "error" },
    limits: { maxRpm: 2500, maxSpeed: 60 },
  },
  "abs-fault": {
    id: "abs-fault",
    name: "ABS averiado",
    description: "Fallo del sensor de rueda: testigo ABS encendido.",
    targetSpeed: cityProfile,
    dtc: [
      {
        code: "C0035",
        status: "stored",
        description: "Sensor de velocidad de rueda delantera izquierda",
      },
    ],
    systems: { abs: "error", esp: "warning" },
  },
  "esp-fault": {
    id: "esp-fault",
    name: "ESP averiado",
    description: "Control de estabilidad desactivado por fallo.",
    targetSpeed: cityProfile,
    dtc: [
      {
        code: "C1234",
        status: "stored",
        description: "Fallo del sistema de control de estabilidad",
      },
    ],
    systems: { esp: "error" },
  },
  "battery-fault": {
    id: "battery-fault",
    name: "Fallo de carga",
    description: "El alternador no carga: tensión baja con motor en marcha.",
    targetSpeed: cityProfile,
    runningVoltage: 11.8,
    dtc: [{ code: "P0562", status: "stored", description: "Tensión del sistema baja" }],
    systems: { engine: "warning" },
  },
};
