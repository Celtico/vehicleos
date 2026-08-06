/**
 * Lado de COMANDO de la telemetría (CQRS ligero).
 * Persiste lotes de muestras, sincroniza los DTC activos y dispara las
 * reglas automáticas de alertas. No expone consultas.
 */
import { BadRequestException, Injectable } from "@nestjs/common";
import type { Alert } from "@prisma/client";
import type { TelemetryBatch } from "@vehicleos/shared";
import { AlertRulesService } from "../alerts/alert-rules.service";
import { PrismaService } from "../prisma/prisma.service";
import { VehiclesService } from "../vehicles/vehicles.service";

/** Resultado de la ingesta de un lote. */
export interface IngestResult {
  /** Nº de muestras persistidas (para el ack del WebSocket). */
  received: number;
  /** Alertas creadas por las reglas automáticas durante la ingesta. */
  alerts: Alert[];
}

@Injectable()
export class TelemetryIngestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicles: VehiclesService,
    private readonly alertRules: AlertRulesService,
  ) {}

  /**
   * Ingesta de un lote de telemetría. Valida que el vehículo pertenezca al
   * usuario, persiste las muestras, sincroniza DTCs y evalúa las reglas.
   */
  async ingestBatch(userId: string, batch: TelemetryBatch): Promise<IngestResult> {
    if (!batch || typeof batch.vehicleId !== "string" || !Array.isArray(batch.samples)) {
      throw new BadRequestException("Lote de telemetría inválido");
    }
    await this.vehicles.assertOwnership(batch.vehicleId, userId);

    // 1) Persistir las muestras del lote.
    if (batch.samples.length > 0) {
      await this.prisma.telemetrySample.createMany({
        data: batch.samples.map((s) => ({
          vehicleId: batch.vehicleId,
          timestamp: new Date(s.timestamp),
          speed: s.speed,
          rpm: s.rpm,
          coolantTemp: s.coolantTemp,
          batteryVoltage: s.batteryVoltage,
          fuelLevel: s.fuelLevel,
          lat: s.location?.lat ?? null,
          lon: s.location?.lon ?? null,
        })),
      });
    }

    const alerts: Alert[] = [];

    // 2) Sincronizar DTCs si el lote los incluye (se envían solo al cambiar,
    //    por lo que el array recibido es el conjunto completo de activos).
    if (batch.dtc !== undefined) {
      const dtcAlerts = await this.syncDtc(batch.vehicleId, batch.dtc);
      alerts.push(...dtcAlerts);
    }

    // 3) Reglas automáticas sobre las muestras.
    const ruleAlerts = await this.alertRules.applyRules(batch.vehicleId, batch.samples);
    alerts.push(...ruleAlerts);

    return { received: batch.samples.length, alerts };
  }

  /**
   * Sincroniza los eventos DTC: abre eventos para códigos nuevos (con su
   * alerta "dtc") y cierra los que ya no aparecen como activos.
   */
  private async syncDtc(
    vehicleId: string,
    dtc: NonNullable<TelemetryBatch["dtc"]>,
  ): Promise<Alert[]> {
    const open = await this.prisma.dtcEvent.findMany({
      where: { vehicleId, clearedAt: null },
    });
    const openCodes = new Set(open.map((e) => e.code));
    const incomingCodes = new Set(dtc.map((d) => d.code));

    const alerts: Alert[] = [];

    // Códigos nuevos → evento + alerta.
    for (const d of dtc) {
      if (openCodes.has(d.code)) continue;
      await this.prisma.dtcEvent.create({
        data: {
          vehicleId,
          code: d.code,
          status: d.status,
          description: d.description ?? null,
        },
      });
      const alert = await this.alertRules.createDtcAlert(vehicleId, d.code);
      if (alert) alerts.push(alert);
    }

    // Códigos que ya no están activos → se cierran.
    const cleared = open.filter((e) => !incomingCodes.has(e.code));
    if (cleared.length > 0) {
      await this.prisma.dtcEvent.updateMany({
        where: { id: { in: cleared.map((e) => e.id) } },
        data: { clearedAt: new Date() },
      });
    }

    return alerts;
  }
}
