/**
 * Tests del TelemetryClient con transporte falso y timers simulados.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ConnectionState,
  DiagnosticTroubleCode,
  TelemetryClientMessage,
  VehicleTelemetry,
} from "@vehicleos/shared";
import { MemoryQueue } from "@vehicleos/storage";
import type { VehicleProvider } from "@vehicleos/vehicle-sdk";
import { TelemetryClient } from "./client";
import type { TelemetryTransport, TransportOptions } from "./transport";

/** Transporte falso controlable desde el test. */
class FakeSocket implements TelemetryTransport {
  static instances: FakeSocket[] = [];
  connected = false;
  sent: TelemetryClientMessage[] = [];
  onOpen: (() => void) | null = null;
  onClose: (() => void) | null = null;
  readonly url: string;
  readonly token?: string;

  constructor(options: TransportOptions) {
    this.url = options.url;
    this.token = options.token;
    FakeSocket.instances.push(this);
  }

  send(message: TelemetryClientMessage): void {
    if (!this.connected) throw new Error("Enlace no abierto");
    this.sent.push(message);
  }

  close(): void {
    this.connected = false;
    this.onOpen = null;
    this.onClose = null;
  }

  /** El test simula que el servidor acepta la conexión. */
  serverOpen(): void {
    this.connected = true;
    this.onOpen?.();
  }

  /** El test simula una caída. */
  serverDrop(): void {
    this.connected = false;
    this.onClose?.();
  }
}

/** Provider falso: emite telemetría cuando el test lo decide. */
function fakeProvider(dtc: DiagnosticTroubleCode[] = []) {
  let listener: ((t: VehicleTelemetry) => void) | null = null;
  const provider: VehicleProvider = {
    id: "fake",
    connect: async () => {},
    disconnect: async () => {},
    state: (): ConnectionState => "connected",
    speed: async () => 0,
    rpm: async () => 0,
    battery: async () => 12.5,
    coolant: async () => 90,
    turbo: async () => 0,
    fuel: async () => 50,
    dtc: async () => dtc,
    clearDtc: async () => {},
    live: (l) => {
      listener = l;
      return () => {
        listener = null;
      };
    },
  };
  const emit = (partial: Partial<VehicleTelemetry> = {}) => {
    listener?.({
      timestamp: Date.now(),
      speed: 50,
      rpm: 2000,
      coolantTemp: 90,
      batteryVoltage: 14.2,
      turboPressure: 0.4,
      fuelLevel: 60,
      engineLoad: 30,
      throttle: 20,
      fuelRate: 5,
      odometer: 84_000,
      engineRunning: true,
      systems: { engine: "ok", abs: "ok", esp: "ok", airbag: "ok" },
      ...partial,
    });
  };
  return { provider, emit, hasListener: () => listener !== null };
}

function parseMessages(socket: FakeSocket): TelemetryClientMessage[] {
  return socket.sent;
}

describe("TelemetryClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeSocket.instances = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeClient(queue = new MemoryQueue(), dtc: DiagnosticTroubleCode[] = []) {
    const fp = fakeProvider(dtc);
    const client = new TelemetryClient({
      provider: fp.provider,
      vehicleId: "sim-001",
      url: "ws://backend/telemetry",
      token: "jwt-demo",
      batchSize: 5,
      queue,
      transportFactory: (options) => new FakeSocket(options),
    });
    return { client, fp, queue };
  }

  it("muestrea a 1 Hz y envía lotes de 5 con el token en la URL", async () => {
    const { client, fp } = makeClient();
    client.start();

    const socket = FakeSocket.instances[0]!;
    // El token viaja en el handshake del socket, no en la URL.
    expect(socket.token).toBe("jwt-demo");
    expect(socket.url).toBe("ws://backend/telemetry");
    socket.serverOpen();

    fp.emit({ speed: 80 });
    await vi.advanceTimersByTimeAsync(5_000); // 5 muestras → 1 lote

    const messages = parseMessages(socket).filter((m) => m.type === "batch");
    expect(messages).toHaveLength(1);
    const first = messages[0]!;
    expect(first.type).toBe("batch");
    if (first.type === "batch") {
      expect(first.payload.vehicleId).toBe("sim-001");
      expect(first.payload.samples).toHaveLength(5);
      expect(first.payload.samples[0]?.speed).toBe(80);
    }

    client.stop();
  });

  it("si el socket cae, encola en storage y drena al reconectar", async () => {
    const queue = new MemoryQueue();
    const { client, fp } = makeClient(queue);
    client.start();

    const socket = FakeSocket.instances[0]!;
    socket.serverOpen();
    const lotes = () => socket.sent.filter((m) => m.type === "batch");
    fp.emit();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(lotes()).toHaveLength(1);

    // Caída del backend: los lotes siguientes van a la cola offline.
    socket.serverDrop();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(await queue.size()).toBe(1);
    expect(lotes()).toHaveLength(1); // no se envió nada más por el socket caído

    // Backoff: a los ~1 s se crea un socket nuevo.
    expect(FakeSocket.instances.length).toBeGreaterThanOrEqual(2);
    const socket2 = FakeSocket.instances[FakeSocket.instances.length - 1]!;
    socket2.serverOpen();
    await vi.advanceTimersByTimeAsync(0);

    // La cola se drenó por el socket nuevo.
    expect(await queue.size()).toBe(0);
    const drained = parseMessages(socket2);
    expect(drained.some((m) => m.type === "batch")).toBe(true);

    client.stop();
  });

  it("aplica backoff exponencial entre reintentos", async () => {
    const { client } = makeClient();
    client.start();

    // Nunca abre: cada intento falla al instante.
    const attempts = () => FakeSocket.instances.length;
    expect(attempts()).toBe(1);
    FakeSocket.instances[0]!.serverDrop();

    await vi.advanceTimersByTimeAsync(999);
    expect(attempts()).toBe(1); // aún dentro del primer backoff (1 s)
    await vi.advanceTimersByTimeAsync(1);
    expect(attempts()).toBe(2);

    FakeSocket.instances[1]!.serverDrop();
    await vi.advanceTimersByTimeAsync(1_999);
    expect(attempts()).toBe(2); // segundo backoff: 2 s
    await vi.advanceTimersByTimeAsync(1);
    expect(attempts()).toBe(3);

    client.stop();
  });

  it("incluye los DTC solo cuando cambian", async () => {
    const dtc: DiagnosticTroubleCode[] = [{ code: "P0401", status: "stored" }];
    const { client, fp } = makeClient(new MemoryQueue(), dtc);
    client.start();
    const socket = FakeSocket.instances[0]!;
    socket.serverOpen();

    fp.emit();
    await vi.advanceTimersByTimeAsync(10_000); // 2 lotes

    const messages = parseMessages(socket).filter((m) => m.type === "batch");
    expect(messages).toHaveLength(2);
    const [a, b] = messages;
    if (a?.type === "batch" && b?.type === "batch") {
      expect(a.payload.dtc).toEqual(dtc); // primer lote: DTC nuevos
      expect(b.payload.dtc).toBeUndefined(); // sin cambios → no viajan
    }

    client.stop();
  });

  it("abre y cierra un viaje al arrancar y parar el motor", async () => {
    const { client, fp } = makeClient();
    client.start();
    const socket = FakeSocket.instances[0]!;
    socket.serverOpen();

    // Motor en marcha → trip-start.
    fp.emit({ engineRunning: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(socket.sent.filter((m) => m.type === "trip-start")).toHaveLength(1);

    // Mientras sigue en marcha no se abren viajes nuevos.
    fp.emit({ engineRunning: true });
    await vi.advanceTimersByTimeAsync(3_000);
    expect(socket.sent.filter((m) => m.type === "trip-start")).toHaveLength(1);

    // Motor parado → trip-end, después de volcar las muestras pendientes.
    fp.emit({ engineRunning: false });
    await vi.advanceTimersByTimeAsync(0);
    const tipos = socket.sent.map((m) => m.type);
    expect(tipos).toContain("trip-end");
    expect(tipos.indexOf("batch")).toBeLessThan(tipos.indexOf("trip-end"));

    client.stop();
  });

  it("stop() cancela el muestreo y la suscripción", async () => {
    const { client, fp } = makeClient();
    client.start();
    expect(fp.hasListener()).toBe(true);
    FakeSocket.instances[0]!.serverOpen();

    client.stop();
    expect(fp.hasListener()).toBe(false);
    fp.emit();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(FakeSocket.instances[0]!.sent.filter((m) => m.type === "batch")).toHaveLength(0);
    expect(client.state()).toBe("idle");
  });
});
