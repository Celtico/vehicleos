/**
 * Fábrica de providers.
 *
 * La PWA elige el provider por configuración (o autodetección) y el
 * resto de la aplicación solo ve la interfaz VehicleProvider.
 */
import type { VehicleProvider } from "./provider";
import {
  AndroidBridgeProvider,
  type AndroidBridgeProviderOptions,
} from "./providers/android-bridge-provider";
import { CanProvider, ThinkDiagProvider, XToolProvider } from "./providers/future";
import { MercedesProvider, type MercedesProviderOptions } from "./providers/mercedes-provider";
import {
  SimulatorProvider,
  type SimulatorProviderOptions,
} from "./providers/simulator-provider";

export type ProviderKind =
  "simulator" | "android-bridge" | "can" | "thinkdiag" | "xtool" | "mercedes";

export interface CreateProviderOptions {
  simulator?: SimulatorProviderOptions;
  androidBridge?: AndroidBridgeProviderOptions;
  /**
   * MercedesProvider necesita un provider base con acceso al adaptador; si
   * no se indica, se envuelve un AndroidBridgeProvider nuevo.
   */
  mercedes?: Omit<MercedesProviderOptions, "base"> & { base?: MercedesProviderOptions["base"] };
}

/** Crea el provider indicado. */
export function createVehicleProvider(
  kind: ProviderKind,
  options: CreateProviderOptions = {},
): VehicleProvider {
  switch (kind) {
    case "simulator":
      return new SimulatorProvider(options.simulator);
    case "android-bridge":
      return new AndroidBridgeProvider(options.androidBridge);
    case "can":
      return new CanProvider();
    case "thinkdiag":
      return new ThinkDiagProvider();
    case "xtool":
      return new XToolProvider();
    case "mercedes": {
      const { base, ...resto } = options.mercedes ?? {};
      return new MercedesProvider({
        base: base ?? new AndroidBridgeProvider(options.androidBridge),
        ...resto,
      });
    }
  }
}
