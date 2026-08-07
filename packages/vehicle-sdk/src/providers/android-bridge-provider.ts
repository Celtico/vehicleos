/**
 * Provider que habla con el Vehicle Bridge (servicio Android) mediante
 * JSON-RPC sobre el WebSocket local `ws://127.0.0.1:8722`.
 *
 * El bridge es el único proceso con acceso a Bluetooth/BLE/USB/WiFi;
 * este provider solo intercambia JSON. Ver contrato en
 * @vehicleos/shared/bridge.
 */
import {
  BRIDGE_WS_URL,
  isBridgeEvent,
  type BridgeMessage,
  type BridgeMethod,
  type BridgeRequest,
  type ConnectionState,
  type DiagnosticTroubleCode,
  type VehicleTelemetry,
} from "@vehicleos/shared";
import { NotConnectedError, type Unsubscribe, type VehicleProvider } from "../provider";

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export interface AndroidBridgeProviderOptions {
  /** URL del WebSocket del bridge. Por defecto la local estándar. */
  url?: string;
  /** Timeout por llamada RPC en ms. */
  callTimeoutMs?: number;
}

export class AndroidBridgeProvider implements VehicleProvider {
  readonly id = "android-bridge";

  private ws: WebSocket | null = null;
  private connectionState: ConnectionState = "disconnected";
  private nextCallId = 1;
  private pending = new Map<number, PendingCall>();
  private liveListeners = new Set<(t: VehicleTelemetry) => void>();
  private readonly url: string;
  private readonly callTimeoutMs: number;

  constructor(options: AndroidBridgeProviderOptions = {}) {
    this.url = options.url ?? BRIDGE_WS_URL;
    this.callTimeoutMs = options.callTimeoutMs ?? 5000;
  }

  /** ¿Hay un bridge disponible en este dispositivo? */
  static isAvailable(): boolean {
    return typeof WebSocket !== "undefined";
  }

  async connect(): Promise<void> {
    if (this.connectionState === "connected") return;
    this.connectionState = "connecting";

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;

      ws.onopen = () => resolve();
      ws.onerror = () => {
        this.connectionState = "error";
        reject(new Error(`No se pudo conectar con el Vehicle Bridge en ${this.url}`));
      };
      ws.onclose = () => {
        this.connectionState = "disconnected";
        this.rejectAllPending(new Error("Conexión con el bridge cerrada"));
      };
      ws.onmessage = (event) => this.handleMessage(String(event.data));
    });

    // Pide al bridge que se conecte físicamente al adaptador OBD.
    await this.call("connect");
    await this.call("subscribe");
    this.connectionState = "connected";
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      try {
        await this.call("unsubscribe").catch(() => undefined);
        await this.call("disconnect").catch(() => undefined);
      } finally {
        this.ws.close();
        this.ws = null;
      }
    }
    this.connectionState = "disconnected";
  }

  state(): ConnectionState {
    return this.connectionState;
  }

  async speed(): Promise<number> {
    return (await this.call("read", { pid: "SPEED" })) as number;
  }
  async rpm(): Promise<number> {
    return (await this.call("read", { pid: "RPM" })) as number;
  }
  async battery(): Promise<number> {
    return (await this.call("read", { pid: "CONTROL_MODULE_VOLTAGE" })) as number;
  }
  async coolant(): Promise<number> {
    return (await this.call("read", { pid: "COOLANT_TEMP" })) as number;
  }
  async turbo(): Promise<number> {
    return (await this.call("read", { pid: "BOOST" })) as number;
  }
  async fuel(): Promise<number> {
    return (await this.call("read", { pid: "FUEL_LEVEL" })) as number;
  }

  async dtc(): Promise<DiagnosticTroubleCode[]> {
    return (await this.call("dtc")) as DiagnosticTroubleCode[];
  }

  async clearDtc(): Promise<void> {
    await this.call("clearDtc");
  }

  /**
   * Envía un comando literal al adaptador y devuelve su respuesta cruda.
   *
   * Lo usa MercedesProvider para hablar con las centralitas que el OBD-II
   * genérico no cubre. No debilita la regla de oro: el hardware lo sigue
   * tocando solo el bridge, esto únicamente le pasa texto.
   */
  async raw(command: string, timeoutMs?: number): Promise<string> {
    const params: Record<string, unknown> = { command };
    if (timeoutMs !== undefined) params.timeoutMs = timeoutMs;
    return (await this.call("raw", params)) as string;
  }

  live(listener: (t: VehicleTelemetry) => void): Unsubscribe {
    if (this.connectionState !== "connected") throw new NotConnectedError(this.id);
    this.liveListeners.add(listener);
    return () => this.liveListeners.delete(listener);
  }

  // ── JSON-RPC ──────────────────────────────────────────────────

  private call(method: BridgeMethod, params?: Record<string, unknown>): Promise<unknown> {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new NotConnectedError(this.id));
    }

    const id = this.nextCallId++;
    const request: BridgeRequest = { id, method, params };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timeout en la llamada "${method}" al bridge`));
      }, this.callTimeoutMs);

      this.pending.set(id, { resolve, reject, timeout });
      ws.send(JSON.stringify(request));
    });
  }

  private handleMessage(raw: string): void {
    let msg: BridgeMessage;
    try {
      msg = JSON.parse(raw) as BridgeMessage;
    } catch {
      return; // mensaje malformado: se ignora
    }

    if (isBridgeEvent(msg)) {
      if (msg.event === "telemetry") {
        const telemetry = msg.data as VehicleTelemetry;
        for (const l of this.liveListeners) l(telemetry);
      }
      return;
    }

    const call = this.pending.get(msg.id);
    if (!call) return;
    this.pending.delete(msg.id);
    clearTimeout(call.timeout);

    if (msg.error) {
      call.reject(new Error(`Bridge error ${msg.error.code}: ${msg.error.message}`));
    } else {
      call.resolve(msg.result);
    }
  }

  private rejectAllPending(err: Error): void {
    for (const [, call] of this.pending) {
      clearTimeout(call.timeout);
      call.reject(err);
    }
    this.pending.clear();
  }
}
