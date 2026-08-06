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
import {
  CanProvider,
  MercedesProvider,
  ThinkDiagProvider,
  XToolProvider,
} from "./providers/future";
import {
  SimulatorProvider,
  type SimulatorProviderOptions,
} from "./providers/simulator-provider";

export type ProviderKind =
  "simulator" | "android-bridge" | "can" | "thinkdiag" | "xtool" | "mercedes";

export interface CreateProviderOptions {
  simulator?: SimulatorProviderOptions;
  androidBridge?: AndroidBridgeProviderOptions;
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
    case "mercedes":
      return new MercedesProvider();
  }
}
