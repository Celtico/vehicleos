/**
 * Motor de reglas automáticas de alertas.
 *
 * Reglas sobre cada muestra de telemetría:
 *  - coolantTemp > 105 °C            → critical "overheat"
 *  - batteryVoltage < 11.8 V con el
 *    motor en marcha (rpm > 500)     → warning  "low-battery"
 *  - fuelLevel < 10 %                → info     "low-fuel"
 *  - DTC nuevo                       → warning  "dtc"
 *
 * Para no inundar al usuario, no se crea una alerta si ya existe otra del
 * mismo tipo sin reconocer para ese vehículo.
 */
import { Injectable } from "@nestjs/common";
import type { Alert } from "@prisma/client";
import type { TelemetrySample, VehicleAlert } from "@vehicleos/shared";
import { PrismaService } from "../prisma/prisma.service";

/** Umbral de temperatura de refrigerante en °C. */
export const UMBRAL_SOBRECALENTAMIENTO = 105;
/** Umbral de tensión de batería en voltios (con motor en marcha). */
export const UMBRAL_BATERIA_BAJA = 11.8;
/** Umbral de nivel de combustible en %. */
export const UMBRAL_COMBUSTIBLE_BAJO = 10;
/** Por debajo de estas rpm consideramos el motor parado. */
export const RPM_MOTOR_EN_MARCHA = 500;

/** Alerta candidata producida por una regla (aún sin persistir). */
export interface AlertCandidate {
  severity: VehicleAlert["severity"];
  kind: VehicleAlert["kind"];
  message: string;
}

/**
 * Función pura: evalúa las reglas sobre una muestra.
 * Se exporta separada del servicio para poder testearla sin dependencias.
 */
export function evaluateSample(sample: TelemetrySample): AlertCandidate[] {
  const candidates: AlertCandidate[] = [];

  if (sample.coolantTemp > UMBRAL_SOBRECALENTAMIENTO) {
    candidates.push({
      severity: "critical",
      kind: "overheat",
      message: `Sobrecalentamiento: refrigerante a ${sample.coolantTemp.toFixed(1)} °C (umbral ${UMBRAL_SOBRECALENTAMIENTO} °C). Detén el vehículo en cuanto sea seguro.`,
    });
  }

  const motorEnMarcha = sample.rpm > RPM_MOTOR_EN_MARCHA;
  if (motorEnMarcha && sample.batteryVoltage < UMBRAL_BATERIA_BAJA) {
    candidates.push({
      severity: "warning",
      kind: "low-battery",
      message: `Tensión de batería baja con el motor en marcha: ${sample.batteryVoltage.toFixed(2)} V (umbral ${UMBRAL_BATERIA_BAJA} V). Posible fallo del alternador.`,
    });
  }

  if (sample.fuelLevel < UMBRAL_COMBUSTIBLE_BAJO) {
    candidates.push({
      severity: "info",
      kind: "low-fuel",
      message: `Nivel de combustible bajo: ${sample.fuelLevel.toFixed(0)} % (umbral ${UMBRAL_COMBUSTIBLE_BAJO} %). Reposta pronto.`,
    });
  }

  return candidates;
}

@Injectable()
export class AlertRulesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evalúa las reglas sobre un lote de muestras y persiste las alertas nuevas.
   * Devuelve las alertas creadas (deduplicadas por tipo dentro del lote y
   * frente a alertas del mismo tipo aún sin reconocer en BD).
   */
  async applyRules(vehicleId: string, samples: TelemetrySample[]): Promise<Alert[]> {
    // Nos quedamos con la primera candidata de cada tipo dentro del lote.
    const porTipo = new Map<string, AlertCandidate>();
    for (const sample of samples) {
      for (const candidate of evaluateSample(sample)) {
        if (!porTipo.has(candidate.kind)) {
          porTipo.set(candidate.kind, candidate);
        }
      }
    }

    const created: Alert[] = [];
    for (const candidate of porTipo.values()) {
      const alert = await this.createIfNotPending(vehicleId, candidate);
      if (alert) {
        created.push(alert);
      }
    }
    return created;
  }

  /** Crea una alerta "dtc" (warning) para un código de avería nuevo. */
  async createDtcAlert(vehicleId: string, code: string): Promise<Alert | null> {
    return this.createIfNotPending(
      vehicleId,
      {
        severity: "warning",
        kind: "dtc",
        message: `Nuevo código de avería detectado: ${code}.`,
      },
      // Para DTCs deduplicamos por mensaje (puede haber varios códigos distintos).
      { dedupeByMessage: true },
    );
  }

  /** Crea la alerta si no existe otra equivalente sin reconocer. */
  private async createIfNotPending(
    vehicleId: string,
    candidate: AlertCandidate,
    opts: { dedupeByMessage?: boolean } = {},
  ): Promise<Alert | null> {
    const existing = await this.prisma.alert.findFirst({
      where: {
        vehicleId,
        kind: candidate.kind,
        acknowledged: false,
        ...(opts.dedupeByMessage ? { message: candidate.message } : {}),
      },
    });
    if (existing) {
      return null;
    }
    return this.prisma.alert.create({
      data: {
        vehicleId,
        severity: candidate.severity,
        kind: candidate.kind,
        message: candidate.message,
      },
    });
  }
}
