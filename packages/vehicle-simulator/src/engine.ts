/**
 * Motor de simulación del vehículo.
 *
 * Modelo físico simplificado pero coherente:
 *  - Un "conductor virtual" persigue la velocidad objetivo del escenario.
 *  - Las rpm derivan de la velocidad y de una caja de cambios de 6 marchas.
 *  - El refrigerante converge exponencialmente a su temperatura objetivo.
 *  - La tensión, el turbo y el consumo dependen del estado del motor.
 *
 * El tick interno corre a `tickHz` (20 Hz por defecto); los suscriptores
 * reciben cada instantánea y la UI interpola a 60 FPS.
 */
import type {
  DiagnosticTroubleCode,
  GeoPoint,
  VehicleSystems,
  VehicleTelemetry,
} from "@vehicleos/shared";
import { SCENARIOS, type ScenarioDefinition, type ScenarioId } from "./scenarios";

export interface SimulatorOptions {
  /** Frecuencia del tick físico en Hz. */
  tickHz?: number;
  /** Temperatura ambiente inicial (°C). */
  ambientTemp?: number;
  /** Nivel de combustible inicial (%). */
  initialFuel?: number;
  /** Odómetro inicial (km). */
  initialOdometer?: number;
  /** Punto GPS inicial (por defecto, Madrid). */
  origin?: GeoPoint;
}

type Listener = (t: VehicleTelemetry) => void;

/** Relaciones de una caja de 6 marchas (rpm por km/h en cada marcha). */
const GEAR_RPM_PER_KMH = [95, 55, 38, 28, 22, 18];
const IDLE_RPM = 800;
const COLD_IDLE_RPM = 1150;

export class VehicleSimulator {
  private readonly tickMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<Listener>();

  private scenario: ScenarioDefinition = SCENARIOS.idle;
  private scenarioTime = 0;

  // Estado físico
  private engineRunning = false;
  private cranking = 0; // segundos restantes de arranque
  private speed = 0;
  private rpm = 0;
  private coolant: number;
  private voltage = 12.4;
  private boost = 0;
  private fuel: number;
  private load = 0;
  private throttle = 0;
  private fuelRate = 0;
  private odometer: number;
  private position: GeoPoint;
  private headingDeg = 0;

  private dtcList: DiagnosticTroubleCode[] = [];
  private systems: VehicleSystems = {
    engine: "ok",
    abs: "ok",
    esp: "ok",
    airbag: "ok",
  };

  constructor(private readonly options: SimulatorOptions = {}) {
    this.tickMs = 1000 / (options.tickHz ?? 20);
    this.coolant = options.ambientTemp ?? 18;
    this.fuel = options.initialFuel ?? 68;
    this.odometer = options.initialOdometer ?? 84_120;
    this.position = options.origin ?? { lat: 40.4168, lon: -3.7038 };
  }

  // ── Ciclo de vida ─────────────────────────────────────────────

  /** Arranca el motor y el bucle de simulación. */
  start(scenario: ScenarioId = "idle"): void {
    this.setScenario(scenario);
    this.engineRunning = true;
    this.cranking = 1.2; // el arranque dura ~1,2 s
    if (!this.timer) {
      this.timer = setInterval(() => this.tick(this.tickMs / 1000), this.tickMs);
    }
  }

  /**
   * Apaga el motor y detiene el bucle.
   *
   * Emite una última instantánea con `engineRunning: false` antes de callar:
   * sin ella los suscriptores se quedarían con el motor eternamente en marcha
   * (es lo que delimita el fin de viaje en @vehicleos/telemetry).
   */
  stop(): void {
    this.engineRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.speed = 0;
    this.rpm = 0;
    this.boost = 0;
    this.fuelRate = 0;
    this.voltage = 12.4;
    this.emit();
  }

  /** Cambia el escenario activo (aplica sus DTCs y estados de sistema). */
  setScenario(id: ScenarioId): void {
    this.scenario = SCENARIOS[id];
    this.scenarioTime = 0;
    this.systems = {
      engine: "ok",
      abs: "ok",
      esp: "ok",
      airbag: "ok",
      ...this.scenario.systems,
    };
    // Sustituye los DTC inyectados por escenario, conservando los manuales no relacionados.
    this.dtcList = [...(this.scenario.dtc ?? [])];
    if (id === "cold-start") this.coolant = 5;
  }

  /** Inyecta un DTC arbitrario (para pruebas). */
  injectDtc(dtc: DiagnosticTroubleCode): void {
    if (!this.dtcList.some((d) => d.code === dtc.code)) this.dtcList.push(dtc);
  }

  /** Borra los DTC (equivalente al modo 04 OBD-II). */
  clearDtc(): void {
    this.dtcList = [];
    if (this.systems.engine === "error" && !this.scenario.limits) this.systems.engine = "ok";
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ── Lecturas puntuales ────────────────────────────────────────

  getTelemetry(): VehicleTelemetry {
    return {
      timestamp: Date.now(),
      speed: round1(this.speed),
      rpm: Math.round(this.rpm),
      coolantTemp: round1(this.coolant),
      batteryVoltage: round2(this.voltage),
      turboPressure: round2(this.boost),
      fuelLevel: round1(this.fuel),
      engineLoad: round1(this.load),
      throttle: round1(this.throttle),
      fuelRate: round2(this.fuelRate),
      odometer: round1(this.odometer),
      engineRunning: this.engineRunning,
      location: { ...this.position, heading: this.headingDeg },
      systems: { ...this.systems },
    };
  }

  getDtc(): DiagnosticTroubleCode[] {
    return [...this.dtcList];
  }

  isRunning(): boolean {
    return this.engineRunning;
  }

  // ── Física ────────────────────────────────────────────────────

  /** Avanza la simulación `dt` segundos. Público para tests deterministas. */
  tick(dt: number): void {
    this.scenarioTime += dt;

    if (this.cranking > 0) {
      // Fase de arranque: rpm de arranque y caída de tensión.
      this.cranking -= dt;
      this.rpm = 250 + Math.random() * 100;
      this.voltage = 10.5 + Math.random() * 0.4;
      this.emit();
      return;
    }

    if (!this.engineRunning) {
      this.emit();
      return;
    }

    // 1. Conductor virtual: persigue la velocidad objetivo del escenario.
    let target = this.scenario.targetSpeed(this.scenarioTime);
    const maxSpeed = this.scenario.limits?.maxSpeed;
    if (maxSpeed !== undefined) target = Math.min(target, maxSpeed);

    const diff = target - this.speed;
    // Aceleración máx ~3 m/s² (10.8 km/h/s), frenada máx ~8 m/s².
    const accel = clamp(diff * 0.8, -8 * 3.6, 3 * 3.6);
    this.speed = Math.max(0, this.speed + accel * dt);
    this.throttle = clamp(diff > 0 ? 20 + diff * 2.2 : 0, 0, 100);

    // 2. Caja de cambios: elige la marcha que deja las rpm en zona útil.
    if (this.speed < 1) {
      const coldFactor = clamp((60 - this.coolant) / 60, 0, 1);
      const idleTarget = IDLE_RPM + (COLD_IDLE_RPM - IDLE_RPM) * coldFactor;
      this.rpm = approach(this.rpm, idleTarget + jitter(15), 2000 * dt);
    } else {
      let gearRpm = 0;
      for (const ratio of GEAR_RPM_PER_KMH) {
        gearRpm = this.speed * ratio;
        if (gearRpm < 3100) break; // cambia de marcha antes de pasar de ~3100
      }
      const targetRpm = clamp(gearRpm + this.throttle * 8, IDLE_RPM, 6500);
      const maxRpm = this.scenario.limits?.maxRpm ?? 6500;
      this.rpm = approach(this.rpm, Math.min(targetRpm, maxRpm), 3500 * dt);
    }

    // 3. Carga y turbo.
    this.load = clamp(this.throttle * 0.9 + this.speed * 0.1, 3, 100);
    const boostTarget = this.rpm > 1800 ? clamp(((this.load - 25) / 75) * 1.4, 0, 1.4) : 0;
    const emergencyCap = this.scenario.limits ? 0.25 : Infinity;
    this.boost = approach(this.boost, Math.min(boostTarget, emergencyCap), 2.2 * dt);

    // 4. Térmica: convergencia exponencial a la temperatura objetivo.
    const coolantTarget = this.scenario.coolantTarget ?? 90;
    const heatRate = this.coolant < coolantTarget ? 0.55 + this.load / 200 : 0.25;
    this.coolant += (coolantTarget - this.coolant) * heatRate * dt * 0.05;
    if (this.coolant > 105) this.systems.engine = this.scenario.systems?.engine ?? "warning";

    // 5. Sistema eléctrico.
    const running = this.scenario.runningVoltage ?? 14.2;
    this.voltage = approach(this.voltage, running + jitter(0.05), 3 * dt);

    // 6. Consumo y combustible.
    this.fuelRate = this.engineRunning
      ? clamp(0.8 + (this.load / 100) * (this.rpm / 1000) * 3.2, 0.6, 45)
      : 0;
    this.fuel = Math.max(0, this.fuel - (this.fuelRate / 3600) * dt * (100 / 55)); // depósito de 55 L

    // 7. Posición: integra la velocidad sobre un rumbo que deriva lentamente.
    const distKm = (this.speed / 3600) * dt;
    this.odometer += distKm;
    this.headingDeg = (this.headingDeg + jitter(1.5) + dt * 2) % 360;
    const rad = (this.headingDeg * Math.PI) / 180;
    this.position = {
      lat: this.position.lat + (distKm / 111) * Math.cos(rad),
      lon:
        this.position.lon +
        (distKm / (111 * Math.cos((this.position.lat * Math.PI) / 180))) * Math.sin(rad),
    };

    this.emit();
  }

  private emit(): void {
    const snapshot = this.getTelemetry();
    for (const l of this.listeners) l(snapshot);
  }
}

// ── Utilidades ──────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Acerca `current` a `target` como máximo `maxDelta` por tick. */
function approach(current: number, target: number, maxDelta: number): number {
  const diff = target - current;
  return current + clamp(diff, -maxDelta, maxDelta);
}

/** Ruido uniforme ±amplitude para dar vida a las lecturas. */
function jitter(amplitude: number): number {
  return (Math.random() * 2 - 1) * amplitude;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
