/**
 * Calendario de mantenimiento calculado desde el odómetro.
 *
 * Modelo simple por intervalos de kilometraje: se asume que el último
 * servicio se hizo en el múltiplo anterior del intervalo.
 */

export type MaintenanceStatus = "ok" | "soon" | "due";

export interface MaintenanceItem {
  id: string;
  name: string;
  /** Descripción corta de la operación. */
  detail: string;
  /** Intervalo en km. */
  intervalKm: number;
  /** Km del último servicio (múltiplo anterior del intervalo). */
  lastServiceKm: number;
  /** Km a los que toca el próximo servicio. */
  dueKm: number;
  /** Km restantes. */
  remainingKm: number;
  /** Progreso del intervalo consumido (0-1). */
  progress: number;
  status: MaintenanceStatus;
}

interface Definition {
  id: string;
  name: string;
  detail: string;
  intervalKm: number;
}

const PLAN: Definition[] = [
  {
    id: "oil",
    name: "Aceite y filtro de aceite",
    detail: "Cambio de aceite 5W-30 y filtro",
    intervalKm: 15_000,
  },
  {
    id: "cabin-filter",
    name: "Filtro de habitáculo",
    detail: "Sustitución del filtro de polen",
    intervalKm: 20_000,
  },
  {
    id: "itv",
    name: "ITV / inspección periódica",
    detail: "Inspección técnica del vehículo",
    intervalKm: 20_000,
  },
  {
    id: "air-filter",
    name: "Filtro de aire",
    detail: "Sustitución del filtro del motor",
    intervalKm: 30_000,
  },
  {
    id: "brake-pads",
    name: "Pastillas de freno",
    detail: "Revisión/sustitución delanteras y traseras",
    intervalKm: 40_000,
  },
  {
    id: "fuel-filter",
    name: "Filtro de combustible",
    detail: "Sustitución del filtro",
    intervalKm: 60_000,
  },
  {
    id: "brake-fluid",
    name: "Líquido de frenos",
    detail: "Purga y sustitución DOT4",
    intervalKm: 60_000,
  },
  {
    id: "spark-plugs",
    name: "Bujías",
    detail: "Sustitución del juego completo",
    intervalKm: 60_000,
  },
  {
    id: "aux-belt",
    name: "Correa auxiliar",
    detail: "Sustitución de correa y tensor",
    intervalKm: 90_000,
  },
  {
    id: "coolant",
    name: "Refrigerante",
    detail: "Sustitución del líquido refrigerante",
    intervalKm: 100_000,
  },
];

/** Umbral de "pronto": queda menos del 12 % del intervalo o < 1500 km. */
function statusFor(remaining: number, interval: number): MaintenanceStatus {
  if (remaining <= 0) return "due";
  if (remaining < Math.min(interval * 0.12, 1_500)) return "soon";
  return "ok";
}

/** Calcula el calendario completo para un odómetro dado. */
export function maintenanceSchedule(odometerKm: number): MaintenanceItem[] {
  return PLAN.map((def) => {
    const lastServiceKm = Math.floor(odometerKm / def.intervalKm) * def.intervalKm;
    const dueKm = lastServiceKm + def.intervalKm;
    const remainingKm = Math.max(0, dueKm - odometerKm);
    const progress = Math.min(1, (odometerKm - lastServiceKm) / def.intervalKm);
    return {
      ...def,
      lastServiceKm,
      dueKm,
      remainingKm,
      progress,
      status: statusFor(remainingKm, def.intervalKm),
    };
  }).sort((a, b) => a.remainingKm - b.remainingKm);
}
