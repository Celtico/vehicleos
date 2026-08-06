/**
 * Servicio de dominio de vehículos.
 * Toda operación está limitada al propietario: un usuario nunca puede ver
 * ni tocar vehículos ajenos (se responde 404 para no filtrar su existencia).
 */
import { Injectable, NotFoundException } from "@nestjs/common";
import type { Vehicle } from "@prisma/client";
import type { DiagnosticTroubleCode, TelemetrySample, VehicleAlert } from "@vehicleos/shared";
import { PrismaService } from "../prisma/prisma.service";
import { rowToSample } from "../telemetry/telemetry.mappers";
import { CreateVehicleDto } from "./dto/create-vehicle.dto";
import { UpdateVehicleDto } from "./dto/update-vehicle.dto";

/** Estado agregado del vehículo para el panel. */
export interface VehicleStatus {
  vehicleId: string;
  /** Última muestra de telemetría recibida (o null si no hay datos). */
  lastSample: TelemetrySample | null;
  /** DTCs activos (sin clearedAt). */
  activeDtc: DiagnosticTroubleCode[];
  /** Alertas sin reconocer. */
  pendingAlerts: VehicleAlert[];
}

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Devuelve el vehículo solo si pertenece al usuario; si no, 404.
   * Reutilizable por el resto de módulos (telemetría, viajes, gateway...).
   */
  async assertOwnership(vehicleId: string, userId: string): Promise<Vehicle> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, ownerId: userId },
    });
    if (!vehicle) {
      throw new NotFoundException("Vehículo no encontrado");
    }
    return vehicle;
  }

  create(userId: string, dto: CreateVehicleDto): Promise<Vehicle> {
    return this.prisma.vehicle.create({
      data: { ...dto, ownerId: userId },
    });
  }

  findAll(userId: string): Promise<Vehicle[]> {
    return this.prisma.vehicle.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: "asc" },
    });
  }

  findOne(userId: string, vehicleId: string): Promise<Vehicle> {
    return this.assertOwnership(vehicleId, userId);
  }

  async update(userId: string, vehicleId: string, dto: UpdateVehicleDto): Promise<Vehicle> {
    await this.assertOwnership(vehicleId, userId);
    return this.prisma.vehicle.update({ where: { id: vehicleId }, data: dto });
  }

  async remove(userId: string, vehicleId: string): Promise<{ deleted: true }> {
    await this.assertOwnership(vehicleId, userId);
    await this.prisma.vehicle.delete({ where: { id: vehicleId } });
    return { deleted: true };
  }

  /** Última muestra + DTCs activos + alertas pendientes. */
  async status(userId: string, vehicleId: string): Promise<VehicleStatus> {
    await this.assertOwnership(vehicleId, userId);

    const [lastSample, activeDtc, pendingAlerts] = await Promise.all([
      this.prisma.telemetrySample.findFirst({
        where: { vehicleId },
        orderBy: { timestamp: "desc" },
      }),
      this.prisma.dtcEvent.findMany({
        where: { vehicleId, clearedAt: null },
        orderBy: { detectedAt: "desc" },
      }),
      this.prisma.alert.findMany({
        where: { vehicleId, acknowledged: false },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      vehicleId,
      lastSample: lastSample ? rowToSample(lastSample) : null,
      activeDtc: activeDtc.map((d) => ({
        code: d.code,
        status: d.status as DiagnosticTroubleCode["status"],
        ...(d.description ? { description: d.description } : {}),
      })),
      pendingAlerts: pendingAlerts.map((a) => ({
        id: a.id,
        vehicleId: a.vehicleId,
        createdAt: a.createdAt.getTime(),
        severity: a.severity as VehicleAlert["severity"],
        kind: a.kind as VehicleAlert["kind"],
        message: a.message,
        acknowledged: a.acknowledged,
      })),
    };
  }
}
