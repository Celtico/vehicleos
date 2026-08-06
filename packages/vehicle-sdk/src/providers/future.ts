/**
 * Providers futuros — stubs tipados que documentan la hoja de ruta.
 *
 * Cada uno implementará VehicleProvider cuando exista el hardware o el
 * protocolo correspondiente. Mientras tanto lanzan un error claro para
 * que la UI pueda mostrar "no disponible" sin casos especiales.
 */
import type { DiagnosticTroubleCode, VehicleTelemetry } from "@vehicleos/shared";
import type { Unsubscribe, VehicleProvider } from "../provider";

/** Base común de los providers aún no implementados. */
abstract class UnimplementedProvider implements VehicleProvider {
  abstract readonly id: string;

  private fail(): never {
    throw new Error(`El provider "${this.id}" aún no está implementado.`);
  }

  async connect(): Promise<void> {
    this.fail();
  }
  async disconnect(): Promise<void> {
    this.fail();
  }
  state(): "disconnected" {
    return "disconnected";
  }
  async speed(): Promise<number> {
    this.fail();
  }
  async rpm(): Promise<number> {
    this.fail();
  }
  async battery(): Promise<number> {
    this.fail();
  }
  async coolant(): Promise<number> {
    this.fail();
  }
  async turbo(): Promise<number> {
    this.fail();
  }
  async fuel(): Promise<number> {
    this.fail();
  }
  async dtc(): Promise<DiagnosticTroubleCode[]> {
    this.fail();
  }
  async clearDtc(): Promise<void> {
    this.fail();
  }
  live(_listener: (t: VehicleTelemetry) => void): Unsubscribe {
    this.fail();
  }
}

/** Acceso directo al bus CAN (p. ej. vía adaptador CAN-USB del bridge). */
export class CanProvider extends UnimplementedProvider {
  readonly id = "can";
}

/** Adaptador profesional ThinkDiag. */
export class ThinkDiagProvider extends UnimplementedProvider {
  readonly id = "thinkdiag";
}

/** Adaptador profesional XTool. */
export class XToolProvider extends UnimplementedProvider {
  readonly id = "xtool";
}

/** Protocolo propietario Mercedes (datos extendidos de confort y chasis). */
export class MercedesProvider extends UnimplementedProvider {
  readonly id = "mercedes";
}
