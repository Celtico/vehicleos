/**
 * Transporte socket.io: el que habla con el gateway del backend.
 *
 * La reconexión propia de socket.io se desactiva a propósito: el
 * TelemetryClient ya implementa backoff exponencial y drenado de la cola
 * offline, y tener dos mecanismos compitiendo provocaría envíos duplicados
 * y reconexiones descoordinadas.
 */
import { io, type Socket } from "socket.io-client";
import type { TelemetryClientMessage } from "@vehicleos/shared";
import {
  normalizeSocketUrl,
  type TelemetryTransport,
  type TransportOptions,
} from "./transport";

class SocketIoTransport implements TelemetryTransport {
  onOpen: (() => void) | null = null;
  onClose: (() => void) | null = null;

  private readonly socket: Socket;

  constructor(options: TransportOptions) {
    this.socket = io(normalizeSocketUrl(options.url), {
      transports: ["websocket"], // sin long-polling: menos batería y latencia
      reconnection: false,
      auth: options.token ? { token: options.token } : undefined,
      ...(options.path ? { path: options.path } : {}),
    });

    this.socket.on("connect", () => this.onOpen?.());
    this.socket.on("disconnect", () => this.onClose?.());
    this.socket.on("connect_error", () => this.onClose?.());
  }

  get connected(): boolean {
    return this.socket.connected;
  }

  /** El nombre del evento es el `type` del mensaje; el cuerpo, su payload. */
  send(message: TelemetryClientMessage): void {
    if (!this.socket.connected) throw new Error("Enlace de telemetría cerrado");
    this.socket.emit(message.type, message.payload);
  }

  close(): void {
    this.onOpen = null;
    this.onClose = null;
    this.socket.removeAllListeners();
    this.socket.disconnect();
  }
}

/** Fábrica por defecto del TelemetryClient. */
export function createSocketIoTransport(options: TransportOptions): TelemetryTransport {
  return new SocketIoTransport(options);
}
