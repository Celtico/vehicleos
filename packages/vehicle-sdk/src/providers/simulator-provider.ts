/**
 * Provider que envuelve el simulador físico de @vehicleos/vehicle-simulator.
 * Se usa en desarrollo, tests y modo demo de la PWA.
 */
import type {
  ConnectionState,
  DiagnosticTroubleCode,
  VehicleTelemetry,
} from "@vehicleos/shared";
import {
  VehicleSimulator,
  type ScenarioId,
  type SimulatorOptions,
} from "@vehicleos/vehicle-simulator";
import { NotConnectedError, type Unsubscribe, type VehicleProvider } from "../provider";

export interface SimulatorProviderOptions extends SimulatorOptions {
  /** Escenario con el que arranca la simulación. */
  scenario?: ScenarioId;
}

export class SimulatorProvider implements VehicleProvider {
  readonly id = "simulator";

  private readonly simulator: VehicleSimulator;
  private readonly scenario: ScenarioId;
  private connectionState: ConnectionState = "disconnected";

  constructor(options: SimulatorProviderOptions = {}) {
    const { scenario, ...simOptions } = options;
    this.simulator = new VehicleSimulator(simOptions);
    this.scenario = scenario ?? "city";
  }

  async connect(): Promise<void> {
    if (this.connectionState === "connected") return;
    this.connectionState = "connecting";
    this.simulator.start(this.scenario);
    this.connectionState = "connected";
  }

  async disconnect(): Promise<void> {
    this.simulator.stop();
    this.connectionState = "disconnected";
  }

  state(): ConnectionState {
    return this.connectionState;
  }

  /** Acceso directo al simulador para la pantalla de configuración/demo. */
  getSimulator(): VehicleSimulator {
    return this.simulator;
  }

  async speed(): Promise<number> {
    return this.read().speed;
  }
  async rpm(): Promise<number> {
    return this.read().rpm;
  }
  async battery(): Promise<number> {
    return this.read().batteryVoltage;
  }
  async coolant(): Promise<number> {
    return this.read().coolantTemp;
  }
  async turbo(): Promise<number> {
    return this.read().turboPressure;
  }
  async fuel(): Promise<number> {
    return this.read().fuelLevel;
  }

  async dtc(): Promise<DiagnosticTroubleCode[]> {
    this.assertConnected();
    return this.simulator.getDtc();
  }

  async clearDtc(): Promise<void> {
    this.assertConnected();
    this.simulator.clearDtc();
  }

  live(listener: (t: VehicleTelemetry) => void): Unsubscribe {
    this.assertConnected();
    return this.simulator.subscribe(listener);
  }

  private read(): VehicleTelemetry {
    this.assertConnected();
    return this.simulator.getTelemetry();
  }

  private assertConnected(): void {
    if (this.connectionState !== "connected") throw new NotConnectedError(this.id);
  }
}
