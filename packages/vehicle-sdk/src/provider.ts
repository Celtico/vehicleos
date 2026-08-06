/**
 * Contrato VehicleProvider.
 *
 * REGLA DE ORO DE VEHICLEOS: la PWA solo habla con este SDK. Nunca con
 * Bluetooth, BLE, USB ni WiFi. El único proceso con acceso al hardware
 * es el Vehicle Bridge (servicio Android), y solo el
 * `AndroidBridgeProvider` de este paquete habla con él.
 */
import type {
  ConnectionState,
  DiagnosticTroubleCode,
  VehicleTelemetry,
} from "@vehicleos/shared";

/** Función de baja para cancelar una suscripción. */
export type Unsubscribe = () => void;

/**
 * Interfaz que implementa toda fuente de datos de vehículo.
 *
 * Implementaciones actuales:
 *  - `SimulatorProvider`     — simulador completo (desarrollo y demo).
 *  - `AndroidBridgeProvider` — adaptador OBD real vía servicio Android.
 *
 * Implementaciones futuras (stubs tipados en `providers/future.ts`):
 *  - CAN directo, ThinkDiag, XTool, Mercedes propietario.
 */
export interface VehicleProvider {
  /** Identificador estable del provider ("simulator", "android-bridge"…). */
  readonly id: string;

  /** Establece la conexión con la fuente de datos. Idempotente. */
  connect(): Promise<void>;

  /** Cierra la conexión y libera recursos. Idempotente. */
  disconnect(): Promise<void>;

  /** Estado actual de la conexión. */
  state(): ConnectionState;

  /** Velocidad instantánea en km/h. */
  speed(): Promise<number>;

  /** Régimen del motor en rpm. */
  rpm(): Promise<number>;

  /** Tensión de batería en voltios. */
  battery(): Promise<number>;

  /** Temperatura del refrigerante en °C. */
  coolant(): Promise<number>;

  /** Presión de turbo relativa en bar. */
  turbo(): Promise<number>;

  /** Nivel de combustible en % (0-100). */
  fuel(): Promise<number>;

  /** Códigos de avería activos. */
  dtc(): Promise<DiagnosticTroubleCode[]>;

  /** Borra los códigos de avería (modo 04 OBD-II). */
  clearDtc(): Promise<void>;

  /**
   * Stream de telemetría en tiempo real (push, sin polling).
   * Devuelve la función de baja. Puede haber varios suscriptores.
   */
  live(listener: (t: VehicleTelemetry) => void): Unsubscribe;
}

/** Error lanzado cuando se opera sobre un provider sin conectar. */
export class NotConnectedError extends Error {
  constructor(providerId: string) {
    super(`El provider "${providerId}" no está conectado. Llama a connect() primero.`);
    this.name = "NotConnectedError";
  }
}
