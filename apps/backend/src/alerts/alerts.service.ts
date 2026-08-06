/** Consultas y acciones sobre alertas del usuario. */
import { Injectable, NotFoundException } from "@nestjs/common";
import type { Alert } from "@prisma/client";
import type { VehicleAlert } from "@vehicleos/shared";
import { PrismaService } from "../prisma/prisma.service";

/** Convierte una fila de BD en el contrato VehicleAlert de shared. */
export function rowToAlert(row: Alert): VehicleAlert {
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    createdAt: row.createdAt.getTime(),
    severity: row.severity as VehicleAlert["severity"],
    kind: row.kind as VehicleAlert["kind"],
    message: row.message,
    acknowledged: row.acknowledged,
  };
}

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Todas las alertas de los vehículos del usuario (recientes primero). */
  async listForUser(userId: string): Promise<VehicleAlert[]> {
    const alerts = await this.prisma.alert.findMany({
      where: { vehicle: { ownerId: userId } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return alerts.map(rowToAlert);
  }

  /** Marca una alerta como reconocida (solo si pertenece al usuario). */
  async acknowledge(userId: string, alertId: string): Promise<VehicleAlert> {
    const alert = await this.prisma.alert.findFirst({
      where: { id: alertId, vehicle: { ownerId: userId } },
    });
    if (!alert) {
      throw new NotFoundException("Alerta no encontrada");
    }
    const updated = await this.prisma.alert.update({
      where: { id: alertId },
      data: { acknowledged: true },
    });
    return rowToAlert(updated);
  }
}
