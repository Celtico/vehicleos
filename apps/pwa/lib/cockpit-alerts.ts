/**
 * Reglas de aviso del cockpit.
 *
 * Evalúa la telemetría en vivo y genera avisos para la pila de
 * notificaciones. Usa los MISMOS umbrales que las reglas del backend
 * (apps/backend/src/alerts/alert-rules.service.ts) para que el conductor
 * y el panel web no vean cosas distintas.
 *
 * El estado se lleva fuera de React: un aviso debe dispararse al *cruzar*
 * el umbral, no en cada muestra a 20 Hz.
 */
import type { CockpitNotification } from "@vehicleos/ui";
import type { DiagnosticTroubleCode, VehicleTelemetry } from "@vehicleos/shared";
import { explainDtc } from "@vehicleos/ai";

/** Umbrales compartidos con el backend. */
export const UMBRAL_SOBRECALENTAMIENTO = 105;
export const UMBRAL_BATERIA_BAJA = 11.8;
export const UMBRAL_COMBUSTIBLE_BAJO = 10;
export const RPM_MOTOR_EN_MARCHA = 500;

/** Histéresis para no repetir el aviso al oscilar en el umbral. */
const HISTERESIS_TEMP = 3;
const HISTERESIS_VOLTAJE = 0.3;
const HISTERESIS_COMBUSTIBLE = 2;

/**
 * De qué condición nace el aviso. Hace falta para poder callar en pantalla
 * los avisos cuya información ya está permanentemente a la vista.
 */
export type OrigenAviso = "dtc" | "temp" | "bateria" | "combustible";

/** Aviso del cockpit con su origen. */
export interface AvisoCockpit extends CockpitNotification {
  origen: OrigenAviso;
}

/** Estado de las condiciones ya avisadas. */
export interface AlertState {
  overheat: boolean;
  lowBattery: boolean;
  lowFuel: boolean;
  /** Códigos ya notificados, para avisar solo de los nuevos. */
  knownDtc: Set<string>;
  /** true hasta la primera evaluación: evita avisar de lo preexistente. */
  primed: boolean;
}

export function createAlertState(): AlertState {
  return {
    overheat: false,
    lowBattery: false,
    lowFuel: false,
    knownDtc: new Set(),
    primed: false,
  };
}

let contador = 0;
function nuevoId(prefijo: string): string {
  contador += 1;
  return `${prefijo}-${contador}`;
}

/**
 * Evalúa una instantánea y devuelve los avisos NUEVOS.
 *
 * Muta `state`: es intencionado, así el llamante no tiene que llevar la
 * contabilidad de qué se avisó ya.
 */
export function evaluarAvisos(
  state: AlertState,
  telemetry: VehicleTelemetry | null,
  dtc: DiagnosticTroubleCode[],
): AvisoCockpit[] {
  const avisos: AvisoCockpit[] = [];

  // Primera pasada: se toma nota de lo que ya había sin avisar de ello.
  // Al arrancar el coche no tiene sentido soltar de golpe todas las averías
  // históricas; eso es la pantalla de diagnóstico, no una notificación.
  if (!state.primed) {
    state.primed = true;
    for (const d of dtc) state.knownDtc.add(d.code);
    return avisos;
  }

  // ── Averías nuevas ──────────────────────────────────────────
  for (const d of dtc) {
    if (state.knownDtc.has(d.code)) continue;
    state.knownDtc.add(d.code);
    const info = explainDtc(d.code);
    avisos.push({
      id: nuevoId("dtc"),
      origen: "dtc",
      severity:
        info.severity === "critical" || info.severity === "high" ? "critical" : "warning",
      title: `Nueva avería: ${d.code}`,
      detail: info.title,
    });
  }
  // Un código que desaparece (borrado o resuelto) vuelve a poder avisar.
  const activos = new Set(dtc.map((d) => d.code));
  for (const code of state.knownDtc) {
    if (!activos.has(code)) state.knownDtc.delete(code);
  }

  if (!telemetry) return avisos;

  // ── Sobrecalentamiento ──────────────────────────────────────
  if (!state.overheat && telemetry.coolantTemp > UMBRAL_SOBRECALENTAMIENTO) {
    state.overheat = true;
    avisos.push({
      id: nuevoId("temp"),
      origen: "temp",
      severity: "critical",
      title: "Motor sobrecalentado",
      detail: `Refrigerante a ${telemetry.coolantTemp.toFixed(0)} °C. Detén el vehículo en cuanto sea seguro.`,
    });
  } else if (
    state.overheat &&
    telemetry.coolantTemp < UMBRAL_SOBRECALENTAMIENTO - HISTERESIS_TEMP
  ) {
    state.overheat = false;
  }

  // ── Tensión baja con el motor en marcha ─────────────────────
  const enMarcha = telemetry.rpm > RPM_MOTOR_EN_MARCHA;
  if (!state.lowBattery && enMarcha && telemetry.batteryVoltage < UMBRAL_BATERIA_BAJA) {
    state.lowBattery = true;
    avisos.push({
      id: nuevoId("bat"),
      origen: "bateria",
      severity: "warning",
      title: "Batería no está cargando",
      detail: `${telemetry.batteryVoltage.toFixed(1)} V con el motor en marcha. Posible fallo del alternador.`,
    });
  } else if (
    state.lowBattery &&
    telemetry.batteryVoltage > UMBRAL_BATERIA_BAJA + HISTERESIS_VOLTAJE
  ) {
    state.lowBattery = false;
  }

  // ── Combustible bajo ────────────────────────────────────────
  if (!state.lowFuel && telemetry.fuelLevel < UMBRAL_COMBUSTIBLE_BAJO) {
    state.lowFuel = true;
    avisos.push({
      id: nuevoId("fuel"),
      origen: "combustible",
      severity: "info",
      title: "Combustible bajo",
      detail: `Queda un ${telemetry.fuelLevel.toFixed(0)} % del depósito.`,
    });
  } else if (
    state.lowFuel &&
    telemetry.fuelLevel > UMBRAL_COMBUSTIBLE_BAJO + HISTERESIS_COMBUSTIBLE
  ) {
    state.lowFuel = false;
  }

  return avisos;
}
