/**
 * TelemetryClient — envío de telemetría al backend por WebSocket.
 *
 * Diseño (sin polling HTTP):
 *  1. Se suscribe UNA vez a `provider.live()` y guarda la última instantánea.
 *  2. Un temporizador muestrea a 1 Hz (`toTelemetrySample`).
 *  3. Cada N muestras (5 por defecto) forma un `TelemetryBatch` y lo envía
 *     como `TelemetryClientMessage` por el transporte (socket.io por defecto,
 *     con el token JWT en el handshake).
 *  4. Si el enlace está caído, encola el lote en @vehicleos/storage y
 *     reintenta la conexión con backoff exponencial; al reconectar drena
 *     la cola en orden.
 */
import {
  toTelemetrySample,
  type DiagnosticTroubleCode,
  type TelemetryBatch,
  type TelemetryClientMessage,
  type TelemetrySample,
  type VehicleTelemetry,
} from "@vehicleos/shared";
import { createOfflineQueue, type OfflineQueue } from "@vehicleos/storage";
import type { Unsubscribe, VehicleProvider } from "@vehicleos/vehicle-sdk";
import { createSocketIoTransport } from "./socketio-transport";
import type { TelemetryTransport, TransportFactory } from "./transport";

/** Estado del enlace con el backend. */
export type TelemetryLinkState = "idle" | "connecting" | "open" | "closed";

export interface TelemetryClientOptions {
  /** Fuente de datos del vehículo (nunca hardware directo). */
  provider: VehicleProvider;
  /** Identificador del vehículo para el backend. */
  vehicleId: string;
  /** URL del backend, p. ej. "http://localhost:3001/telemetry". */
  url: string;
  /** Token JWT; viaja en el handshake del socket. */
  token?: string;
  /** Muestras por lote (por defecto 5). */
  batchSize?: number;
  /** Periodo de muestreo en ms (por defecto 1000 → 1 Hz). */
  sampleIntervalMs?: number;
  /** Cola offline; por defecto la de @vehicleos/storage. */
  queue?: OfflineQueue;
  /** Fábrica de transporte (inyectable en tests; socket.io por defecto). */
  transportFactory?: TransportFactory;
  /** Backoff inicial en ms (por defecto 1000). */
  initialBackoffMs?: number;
  /** Backoff máximo en ms (por defecto 30000). */
  maxBackoffMs?: number;
  /** Notificación de cambios de estado del enlace. */
  onStateChange?: (state: TelemetryLinkState) => void;
}

export class TelemetryClient {
  private readonly provider: VehicleProvider;
  private readonly vehicleId: string;
  private readonly url: string;
  private readonly token?: string;
  private readonly batchSize: number;
  private readonly sampleIntervalMs: number;
  private readonly queue: OfflineQueue;
  private readonly transportFactory: TransportFactory;
  private readonly initialBackoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly onStateChange?: (state: TelemetryLinkState) => void;

  private transport: TelemetryTransport | null = null;
  private running = false;
  private linkState: TelemetryLinkState = "idle";
  private unsubscribe: Unsubscribe | null = null;
  private sampleTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;

  private lastTelemetry: VehicleTelemetry | null = null;
  private buffer: TelemetrySample[] = [];
  private lastDtcJson = "";
  /** Último estado conocido del motor, para detectar inicio/fin de viaje. */
  private engineWasRunning = false;

  constructor(options: TelemetryClientOptions) {
    this.provider = options.provider;
    this.vehicleId = options.vehicleId;
    this.url = options.url;
    this.token = options.token;
    this.batchSize = options.batchSize ?? 5;
    this.sampleIntervalMs = options.sampleIntervalMs ?? 1000;
    this.queue = options.queue ?? createOfflineQueue();
    this.transportFactory = options.transportFactory ?? createSocketIoTransport;
    this.initialBackoffMs = options.initialBackoffMs ?? 1000;
    this.maxBackoffMs = options.maxBackoffMs ?? 30_000;
    this.onStateChange = options.onStateChange;
  }

  /** Estado actual del enlace. */
  state(): TelemetryLinkState {
    return this.linkState;
  }

  /** Arranca la suscripción, el muestreo y la conexión. Idempotente. */
  start(): void {
    if (this.running) return;
    this.running = true;

    // Suscripción única al stream en vivo: guardamos la última instantánea
    // y detectamos el arranque/parada del motor para delimitar el viaje.
    this.unsubscribe = this.provider.live((t) => {
      this.lastTelemetry = t;
      this.trackTrip(t);
    });

    // Muestreo a 1 Hz.
    this.sampleTimer = setInterval(() => {
      if (!this.lastTelemetry) return;
      this.buffer.push(toTelemetrySample(this.lastTelemetry));
      if (this.buffer.length >= this.batchSize) {
        void this.flush();
      }
    }, this.sampleIntervalMs);

    this.connect();
  }

  /** Detiene todo y cierra el socket. Idempotente. */
  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.sampleTimer) clearInterval(this.sampleTimer);
    this.sampleTimer = null;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.transport) {
      const transport = this.transport;
      this.transport = null;
      transport.close();
    }
    this.setLinkState("idle");
  }

  // ── Viajes ────────────────────────────────────────────────────

  /**
   * Delimita el viaje según el estado del motor: arrancar abre uno y parar
   * lo cierra. Es lo que alimenta la pantalla de Viajes y el cálculo de
   * distancia y consumo del backend.
   *
   * A diferencia de los lotes, estos avisos no se encolan si el enlace está
   * caído: un viaje a medias es peor que ninguno, y el backend cierra por su
   * cuenta los viajes que quedan abiertos.
   */
  private trackTrip(t: VehicleTelemetry): void {
    if (t.engineRunning === this.engineWasRunning) return;
    this.engineWasRunning = t.engineRunning;

    if (t.engineRunning) {
      this.trySend({
        type: "trip-start",
        payload: { vehicleId: this.vehicleId, startedAt: t.timestamp },
      });
      return;
    }

    // Al parar: primero vuelcan las muestras pendientes, luego se cierra.
    void this.flush().then(() => {
      this.trySend({
        type: "trip-end",
        payload: { vehicleId: this.vehicleId, endedAt: t.timestamp },
      });
    });
  }

  /** Envía si el enlace está abierto; si no, descarta en silencio. */
  private trySend(message: TelemetryClientMessage): void {
    if (!this.transport?.connected) return;
    try {
      this.transport.send(message);
    } catch {
      // Enlace caído entre la comprobación y el envío: se descarta.
    }
  }

  // ── Lotes ─────────────────────────────────────────────────────

  /** Forma un lote con el buffer actual y lo envía o encola. */
  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const samples = this.buffer.splice(0, this.buffer.length);
    const batch: TelemetryBatch = { vehicleId: this.vehicleId, samples };

    // Adjunta los DTC solo si han cambiado desde el último envío.
    try {
      const dtc = await this.provider.dtc();
      const json = JSON.stringify(dtc.map((d: DiagnosticTroubleCode) => d.code).sort());
      if (json !== this.lastDtcJson) {
        this.lastDtcJson = json;
        batch.dtc = dtc;
      }
    } catch {
      // El provider puede no estar conectado; el lote viaja sin DTC.
    }

    await this.deliver(batch);
  }

  /** Envía por el enlace si está abierto; si no, encola en storage. */
  private async deliver(batch: TelemetryBatch): Promise<void> {
    if (this.transport?.connected) {
      const message: TelemetryClientMessage = { type: "batch", payload: batch };
      try {
        this.transport.send(message);
        return;
      } catch {
        // El envío falló: cae a la cola offline.
      }
    }
    await this.queue.push(batch);
  }

  /** Drena la cola offline en orden tras reconectar. */
  private async drainQueue(): Promise<void> {
    while (this.transport?.connected) {
      const pending = await this.queue.drain(20);
      if (pending.length === 0) return;
      for (const batch of pending) {
        if (this.transport?.connected) {
          this.transport.send({ type: "batch", payload: batch });
        } else {
          // Se cayó a mitad de drenaje: devuelve lo no enviado a la cola.
          await this.queue.push(batch);
        }
      }
    }
  }

  // ── Conexión y reintento ──────────────────────────────────────

  private connect(): void {
    if (!this.running) return;
    this.setLinkState("connecting");

    let transport: TelemetryTransport;
    try {
      transport = this.transportFactory({ url: this.url, token: this.token });
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.transport = transport;

    transport.onOpen = () => {
      this.reconnectAttempts = 0;
      this.setLinkState("open");
      void this.drainQueue();
    };
    transport.onClose = () => this.handleDrop();
  }

  private handleDrop(): void {
    if (this.transport) {
      this.transport.onOpen = null;
      this.transport.onClose = null;
      this.transport = null;
    }
    if (!this.running) return;
    this.setLinkState("closed");
    this.scheduleReconnect();
  }

  /** Backoff exponencial: 1 s, 2 s, 4 s… hasta `maxBackoffMs`. */
  private scheduleReconnect(): void {
    if (!this.running || this.reconnectTimer) return;
    const delay = Math.min(
      this.initialBackoffMs * 2 ** this.reconnectAttempts,
      this.maxBackoffMs,
    );
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private setLinkState(state: TelemetryLinkState): void {
    if (this.linkState === state) return;
    this.linkState = state;
    this.onStateChange?.(state);
  }
}
