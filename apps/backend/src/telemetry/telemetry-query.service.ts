/**
 * Lado de CONSULTA de la telemetría (CQRS ligero).
 * Series temporales para gráficas y agregados para el panel. No escribe nada.
 */
import { Injectable } from "@nestjs/common";
import type { TelemetrySample } from "@vehicleos/shared";
import { PrismaService } from "../prisma/prisma.service";
import { VehiclesService } from "../vehicles/vehicles.service";
import { rowToSample } from "./telemetry.mappers";

/** Límite por defecto y máximo de puntos por consulta de serie. */
const LIMITE_POR_DEFECTO = 500;
const LIMITE_MAXIMO = 5000;

/** Agregados de telemetría de un vehículo. */
export interface TelemetryStats {
  vehicleId: string;
  /** Nº total de muestras almacenadas. */
  sampleCount: number;
  /** Km recorridos (suma de las distancias de los viajes). */
  distanceKm: number;
  /** Velocidad media en km/h sobre todas las muestras. */
  avgSpeed: number;
  /** Velocidad máxima registrada en km/h. */
  maxSpeed: number;
  /** Consumo medio en L/100km (media de los viajes cerrados). */
  avgConsumption: number;
}

@Injectable()
export class TelemetryQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicles: VehiclesService,
  ) {}

  /** Serie temporal de muestras para gráficas, en orden cronológico. */
  async getSeries(
    userId: string,
    vehicleId: string,
    opts: { from?: number; to?: number; limit?: number },
  ): Promise<TelemetrySample[]> {
    await this.vehicles.assertOwnership(vehicleId, userId);
    const limit = Math.min(opts.limit ?? LIMITE_POR_DEFECTO, LIMITE_MAXIMO);

    const rows = await this.prisma.telemetrySample.findMany({
      where: {
        vehicleId,
        ...(opts.from !== undefined || opts.to !== undefined
          ? {
              timestamp: {
                ...(opts.from !== undefined ? { gte: new Date(opts.from) } : {}),
                ...(opts.to !== undefined ? { lte: new Date(opts.to) } : {}),
              },
            }
          : {}),
      },
      // Nos quedamos con las N más recientes del rango y las devolvemos
      // en orden ascendente para pintarlas directamente.
      orderBy: { timestamp: "desc" },
      take: limit,
    });
    return rows.reverse().map(rowToSample);
  }

  /** Agregados: km recorridos, velocidad media/máx, consumo medio, nº muestras. */
  async getStats(userId: string, vehicleId: string): Promise<TelemetryStats> {
    await this.vehicles.assertOwnership(vehicleId, userId);

    const [sampleAgg, tripAgg, consumptionAgg] = await Promise.all([
      this.prisma.telemetrySample.aggregate({
        where: { vehicleId },
        _count: { _all: true },
        _avg: { speed: true },
        _max: { speed: true },
      }),
      this.prisma.trip.aggregate({
        where: { vehicleId },
        _sum: { distanceKm: true },
      }),
      // El consumo medio solo tiene sentido sobre viajes cerrados con consumo > 0.
      this.prisma.trip.aggregate({
        where: { vehicleId, endedAt: { not: null }, avgConsumption: { gt: 0 } },
        _avg: { avgConsumption: true },
      }),
    ]);

    return {
      vehicleId,
      sampleCount: sampleAgg._count._all,
      distanceKm: round2(tripAgg._sum.distanceKm ?? 0),
      avgSpeed: round2(sampleAgg._avg.speed ?? 0),
      maxSpeed: round2(sampleAgg._max.speed ?? 0),
      avgConsumption: round2(consumptionAgg._avg.avgConsumption ?? 0),
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
