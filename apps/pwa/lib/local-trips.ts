/**
 * Viajes de demostración: fallback local cuando el backend no responde.
 * Rutas cortas por Madrid coherentes con el origen del simulador.
 */
import type { Trip } from "@vehicleos/shared";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

export const LOCAL_TRIPS: Trip[] = [
  {
    id: "local-1",
    vehicleId: "sim-001",
    startedAt: now - 2 * 60 * 60 * 1000,
    endedAt: now - 90 * 60 * 1000,
    distanceKm: 18.4,
    avgConsumption: 6.1,
    maxSpeed: 92,
    avgSpeed: 37,
    path: [
      { lat: 40.4168, lon: -3.7038 },
      { lat: 40.4301, lon: -3.6921 },
      { lat: 40.4469, lon: -3.6802 },
    ],
  },
  {
    id: "local-2",
    vehicleId: "sim-001",
    startedAt: now - DAY,
    endedAt: now - DAY + 55 * 60 * 1000,
    distanceKm: 64.2,
    avgConsumption: 5.4,
    maxSpeed: 124,
    avgSpeed: 70,
    path: [
      { lat: 40.4168, lon: -3.7038 },
      { lat: 40.4894, lon: -3.679 },
      { lat: 40.5411, lon: -3.6416 },
    ],
  },
  {
    id: "local-3",
    vehicleId: "sim-001",
    startedAt: now - 2 * DAY,
    endedAt: now - 2 * DAY + 25 * 60 * 1000,
    distanceKm: 7.9,
    avgConsumption: 7.8,
    maxSpeed: 58,
    avgSpeed: 19,
    path: [
      { lat: 40.4168, lon: -3.7038 },
      { lat: 40.4102, lon: -3.7124 },
      { lat: 40.4053, lon: -3.719 },
    ],
  },
  {
    id: "local-4",
    vehicleId: "sim-001",
    startedAt: now - 4 * DAY,
    endedAt: now - 4 * DAY + 130 * 60 * 1000,
    distanceKm: 182.6,
    avgConsumption: 5.9,
    maxSpeed: 128,
    avgSpeed: 84,
    path: [
      { lat: 40.4168, lon: -3.7038 },
      { lat: 40.6516, lon: -4.0002 },
      { lat: 40.9701, lon: -4.11 },
    ],
  },
];
