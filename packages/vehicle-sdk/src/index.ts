/**
 * @vehicleos/vehicle-sdk — punto de entrada único de la PWA al vehículo.
 */
export { NotConnectedError, type Unsubscribe, type VehicleProvider } from "./provider";
export {
  createVehicleProvider,
  type CreateProviderOptions,
  type ProviderKind,
} from "./factory";
export {
  SimulatorProvider,
  type SimulatorProviderOptions,
} from "./providers/simulator-provider";
export {
  AndroidBridgeProvider,
  type AndroidBridgeProviderOptions,
} from "./providers/android-bridge-provider";
export {
  CanProvider,
  MercedesProvider,
  ThinkDiagProvider,
  XToolProvider,
} from "./providers/future";
