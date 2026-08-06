/**
 * Transporte del enlace de telemetría.
 *
 * El backend expone un gateway socket.io en el namespace `/telemetry`
 * (ver apps/backend/src/telemetry/telemetry.gateway.ts), donde el nombre
 * del evento coincide con el campo `type` de `TelemetryClientMessage`:
 * "batch", "trip-start" y "trip-end".
 *
 * Esta interfaz aísla ese detalle para que el TelemetryClient hable de
 * mensajes de dominio y los tests puedan inyectar un transporte falso.
 */
import type { TelemetryClientMessage } from "@vehicleos/shared";

export interface TelemetryTransport {
  /** ¿Está el enlace listo para enviar? */
  readonly connected: boolean;
  /** Envía un mensaje de dominio. Puede lanzar si el enlace cayó. */
  send(message: TelemetryClientMessage): void;
  /** Cierra el enlace y libera los callbacks. */
  close(): void;
  /** Lo invoca el transporte al establecerse la conexión. */
  onOpen: (() => void) | null;
  /** Lo invoca el transporte al caerse o fallar la conexión. */
  onClose: (() => void) | null;
}

export interface TransportOptions {
  /** URL del backend, p. ej. "http://localhost:3001/telemetry". */
  url: string;
  /** Token JWT; viaja en el handshake (`auth.token`). */
  token?: string;
}

/** Fábrica de transportes (inyectable en tests). */
export type TransportFactory = (options: TransportOptions) => TelemetryTransport;

/**
 * Normaliza la URL para socket.io.
 *
 * Se acepta `ws://`/`wss://` por comodidad (es lo natural al configurar
 * "un WebSocket"), pero socket.io espera `http://`/`https://`.
 */
export function normalizeSocketUrl(url: string): string {
  return url.replace(/^ws:\/\//i, "http://").replace(/^wss:\/\//i, "https://");
}
