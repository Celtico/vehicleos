/**
 * Servicio de dominio de viajes.
 * Un viaje se abre con "trip-start" y se cierra con "trip-end"; al cerrarlo
 * se calculan los agregados a partir de las muestras persistidas.
 */
import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, Trip as TripRow } from "@prisma/client";
import type { GeoPoint, Trip } from "@vehicleos/shared";
import { PrismaService } from "../prisma/prisma.service";
import { VehiclesService } from "../vehicles/vehicles.service";

/**
 * Capacidad de depósito asumida para estimar litros consumidos a partir del
 * porcentaje de combustible (las muestras solo llevan fuelLevel en %).
 */
export const CAPACIDAD_DEPOSITO_L = 50;

/** Máximo de puntos GPS guardados en la ruta de un viaje. */
const MAX_PUNTOS_RUTA = 200;

/** Distancia haversine entre dos puntos GPS, en km. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371; // Radio terrestre medio en km.
  const rad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Convierte una fila de BD en el contrato Trip de shared (tiempos en ms). */
export function rowToTrip(row: TripRow): Trip {
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    startedAt: row.startedAt.getTime(),
    ...(row.endedAt ? { endedAt: row.endedAt.getTime() } : {}),
    distanceKm: row.distanceKm,
    avgConsumption: row.avgConsumption,
    maxSpeed: row.maxSpeed,
    avgSpeed: row.avgSpeed,
    path: (row.path as unknown as GeoPoint[]) ?? [],
  };
}

@Injectable()
export class TripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicles: VehiclesService,
  ) {}

  /** Lista de viajes del vehículo (recientes primero). */
  async listForVehicle(userId: string, vehicleId: string): Promise<Trip[]> {
    await this.vehicles.assertOwnership(vehicleId, userId);
    const trips = await this.prisma.trip.findMany({
      where: { vehicleId },
      orderBy: { startedAt: "desc" },
    });
    return trips.map(rowToTrip);
  }

  /**
   * Abre un viaje ("trip-start"). Si ya hay uno abierto, se reutiliza
   * (el emisor puede reintentar el mensaje tras una reconexión).
   */
  async startTrip(userId: string, vehicleId: string, startedAt: number): Promise<Trip> {
    await this.vehicles.assertOwnership(vehicleId, userId);
    const open = await this.prisma.trip.findFirst({
      where: { vehicleId, endedAt: null },
      orderBy: { startedAt: "desc" },
    });
    if (open) {
      return rowToTrip(open);
    }
    const trip = await this.prisma.trip.create({
      data: { vehicleId, startedAt: new Date(startedAt) },
    });
    return rowToTrip(trip);
  }

  /**
   * Cierra el viaje abierto ("trip-end") y calcula sus agregados con las
   * muestras persistidas entre el inicio y el fin.
   */
  async endTrip(userId: string, vehicleId: string, endedAt: number): Promise<Trip> {
    await this.vehicles.assertOwnership(vehicleId, userId);
    const open = await this.prisma.trip.findFirst({
      where: { vehicleId, endedAt: null },
      orderBy: { startedAt: "desc" },
    });
    if (!open) {
      throw new NotFoundException("No hay ningún viaje abierto para este vehículo");
    }

    const end = new Date(endedAt);
    const samples = await this.prisma.telemetrySample.findMany({
      where: { vehicleId, timestamp: { gte: open.startedAt, lte: end } },
      orderBy: { timestamp: "asc" },
    });

    const stats = this.computeTripStats(samples);
    const updated = await this.prisma.trip.update({
      where: { id: open.id },
      data: {
        endedAt: end,
        distanceKm: stats.distanceKm,
        avgConsumption: stats.avgConsumption,
        maxSpeed: stats.maxSpeed,
        avgSpeed: stats.avgSpeed,
        path: stats.path as unknown as Prisma.InputJsonValue,
      },
    });
    return rowToTrip(updated);
  }

  /** Agregados del viaje a partir de sus muestras. */
  private computeTripStats(
    samples: Array<{
      timestamp: Date;
      speed: number;
      fuelLevel: number;
      lat: number | null;
      lon: number | null;
    }>,
  ): {
    distanceKm: number;
    avgConsumption: number;
    maxSpeed: number;
    avgSpeed: number;
    path: GeoPoint[];
  } {
    if (samples.length === 0) {
      return { distanceKm: 0, avgConsumption: 0, maxSpeed: 0, avgSpeed: 0, path: [] };
    }

    let maxSpeed = 0;
    let sumSpeed = 0;
    const gps: GeoPoint[] = [];
    for (const s of samples) {
      maxSpeed = Math.max(maxSpeed, s.speed);
      sumSpeed += s.speed;
      if (s.lat !== null && s.lon !== null) {
        gps.push({ lat: s.lat, lon: s.lon });
      }
    }
    const avgSpeed = sumSpeed / samples.length;

    // Distancia: preferimos GPS (haversine); si no hay ruta, integramos la
    // velocidad en el tiempo (regla del trapecio).
    let distanceKm = 0;
    if (gps.length >= 2) {
      for (let i = 1; i < gps.length; i++) {
        distanceKm += haversineKm(gps[i - 1] as GeoPoint, gps[i] as GeoPoint);
      }
    } else {
      for (let i = 1; i < samples.length; i++) {
        const a = samples[i - 1];
        const b = samples[i];
        if (!a || !b) continue;
        const horas = (b.timestamp.getTime() - a.timestamp.getTime()) / 3_600_000;
        if (horas > 0) {
          distanceKm += ((a.speed + b.speed) / 2) * horas;
        }
      }
    }

    // Consumo medio estimado a partir de la caída del nivel de combustible.
    const first = samples[0];
    const last = samples[samples.length - 1];
    let avgConsumption = 0;
    if (first && last && distanceKm > 0.1) {
      const caidaPct = Math.max(0, first.fuelLevel - last.fuelLevel);
      const litros = (caidaPct / 100) * CAPACIDAD_DEPOSITO_L;
      avgConsumption = (litros / distanceKm) * 100; // L/100km
    }

    // Ruta muestreada (como mucho MAX_PUNTOS_RUTA puntos).
    const paso = Math.max(1, Math.ceil(gps.length / MAX_PUNTOS_RUTA));
    const path = gps.filter((_, i) => i % paso === 0);

    return {
      distanceKm: round2(distanceKm),
      avgConsumption: round2(avgConsumption),
      maxSpeed: round2(maxSpeed),
      avgSpeed: round2(avgSpeed),
      path,
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
