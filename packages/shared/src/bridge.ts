/**
 * Contrato del Vehicle Bridge (servicio Android).
 *
 * El bridge es el ÚNICO proceso con acceso al hardware (Bluetooth, BLE,
 * USB, WiFi). Expone su API a la PWA por dos vías equivalentes:
 *
 *  1. WebView: objeto `window.VehicleBridge` inyectado con
 *     `addJavascriptInterface` (síncrono por strings JSON).
 *  2. Navegador: servidor WebSocket local en `ws://127.0.0.1:8722`
 *     con mensajes JSON-RPC definidos aquí.
 *
 * La PWA nunca usa esto directamente: solo lo hace el
 * `AndroidBridgeProvider` de @vehicleos/vehicle-sdk.
 */

/** Puerto del WebSocket local que abre el servicio Android. */
export const BRIDGE_WS_PORT = 8722;
export const BRIDGE_WS_URL = `ws://127.0.0.1:${BRIDGE_WS_PORT}`;

/** Métodos JSON-RPC que implementa el bridge. */
export type BridgeMethod =
  | "connect"
  | "disconnect"
  | "status"
  | "read" // params: { pid: string } — lectura puntual de un PID
  | "dtc"
  | "clearDtc"
  | "subscribe" // inicia el stream de telemetría (eventos "telemetry")
  | "unsubscribe";

/** Petición JSON-RPC de la PWA/SDK hacia el bridge. */
export interface BridgeRequest {
  id: number;
  method: BridgeMethod;
  params?: Record<string, unknown>;
}

/** Respuesta del bridge a una petición. */
export interface BridgeResponse {
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

/** Evento push del bridge (sin `id`, no responde a ninguna petición). */
export interface BridgeEvent {
  event: "telemetry" | "connection" | "error";
  data: unknown;
}

export type BridgeMessage = BridgeResponse | BridgeEvent;

/** Interfaz que Android inyecta en la WebView como `window.VehicleBridge`. */
export interface VehicleBridgeWebView {
  /** Envía una BridgeRequest serializada; la respuesta llega por callback global. */
  postMessage(requestJson: string): void;
}

/** Type guard: ¿es un evento push (y no una respuesta)? */
export function isBridgeEvent(msg: BridgeMessage): msg is BridgeEvent {
  return "event" in msg;
}
