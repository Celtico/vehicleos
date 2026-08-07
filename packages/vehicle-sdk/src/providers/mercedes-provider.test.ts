/**
 * Tests del MercedesProvider con un adaptador falso que habla KWP2000.
 *
 * El adaptador simula centralitas reales: responden a su dirección y
 * callan ante cualquier otra, que es exactamente el comportamiento que
 * distingue un módulo presente de uno inexistente.
 */
import { describe, expect, it } from "vitest";
import type {
  ConnectionState,
  DiagnosticTroubleCode,
  VehicleTelemetry,
} from "@vehicleos/shared";
import { MercedesProvider, type EcuModule } from "./mercedes-provider";

/** Centralita simulada: qué códigos tiene y si exige abrir sesión. */
interface EcuFalsa {
  address: number;
  /** Tramas de código: [alto, bajo, estado] por avería. */
  dtc: number[][];
  /** Si es true, rechaza todo hasta que se abra sesión de diagnóstico. */
  exigeSesion?: boolean;
  /** Nº de veces que contesta "respuesta pendiente" antes de responder. */
  ocupadaVeces?: number;
}

/** Construye la trama completa con cabecera y suma de comprobación. */
function trama(origen: number, datos: number[]): string {
  const cabecera = [0x81, 0xf1, origen];
  const cuerpo = [...cabecera, ...datos];
  const suma = cuerpo.reduce((a, b) => (a + b) & 0xff, 0);
  return [...cuerpo, suma].map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");
}

/** Adaptador falso con un puñado de centralitas dentro. */
function adaptadorFalso(ecus: EcuFalsa[], dtcEstandar: DiagnosticTroubleCode[] = []) {
  let destino = 0;
  const sesionAbierta = new Set<number>();
  const pendientes = new Map<number, number>();
  const comandos: string[] = [];

  const base = {
    id: "falso",
    connect: async () => {},
    disconnect: async () => {},
    state: (): ConnectionState => "connected",
    speed: async () => 50,
    rpm: async () => 2000,
    battery: async () => 14.2,
    coolant: async () => 90,
    turbo: async () => 0.3,
    fuel: async () => 60,
    dtc: async () => dtcEstandar,
    clearDtc: async () => {},
    live: (l: (t: VehicleTelemetry) => void) => {
      listener = l;
      return () => {
        listener = null;
      };
    },
    raw: async (command: string): Promise<string> => {
      comandos.push(command);

      if (command.startsWith("ATSH")) {
        destino = parseInt(command.slice(6, 8), 16);
        return "OK";
      }
      if (command.startsWith("AT")) return "OK";

      const ecu = ecus.find((e) => e.address === destino);
      if (!ecu) return "NO DATA";

      const servicio = parseInt(command.slice(0, 2), 16);

      // Sesión de diagnóstico
      if (servicio === 0x10) {
        sesionAbierta.add(ecu.address);
        return trama(ecu.address, [0x50, 0x81]);
      }

      if (ecu.exigeSesion && !sesionAbierta.has(ecu.address)) {
        // 0x22: condiciones incorrectas
        return trama(ecu.address, [0x7f, servicio, 0x22]);
      }

      // "Ocupada, respuesta pendiente" las primeras veces
      const quedan = pendientes.get(ecu.address) ?? ecu.ocupadaVeces ?? 0;
      if (quedan > 0) {
        pendientes.set(ecu.address, quedan - 1);
        return trama(ecu.address, [0x7f, servicio, 0x78]);
      }

      if (servicio === 0x18) {
        const cuerpo = [0x58, ecu.dtc.length, ...ecu.dtc.flat()];
        return trama(ecu.address, cuerpo);
      }
      if (servicio === 0x14) {
        ecu.dtc = [];
        return trama(ecu.address, [0x54]);
      }
      if (servicio === 0x1a) {
        return trama(ecu.address, [0x5a, 0x80, 0xab, 0xcd]);
      }
      return trama(ecu.address, [0x7f, servicio, 0x11]);
    },
  };

  let listener: ((t: VehicleTelemetry) => void) | null = null;
  const emitir = (parcial: Partial<VehicleTelemetry> = {}) => {
    listener?.({
      timestamp: Date.now(),
      speed: 50,
      rpm: 2000,
      coolantTemp: 90,
      batteryVoltage: 14.2,
      turboPressure: 0.3,
      fuelLevel: 60,
      engineLoad: 30,
      throttle: 20,
      fuelRate: 5,
      odometer: 84_000,
      engineRunning: true,
      systems: { engine: "ok", abs: "ok", esp: "ok", airbag: "ok" },
      ...parcial,
    });
  };

  return { base, emitir, comandos };
}

const MODULO_ABS: EcuModule = {
  address: 0x28,
  name: "ABS/ESP",
  kind: "abs",
  prefix: "ABS",
};
const MODULO_AIRBAG: EcuModule = {
  address: 0x38,
  name: "Airbag",
  kind: "airbag",
  prefix: "SRS",
};

describe("MercedesProvider", () => {
  it("sin módulos configurados se comporta como el provider base", async () => {
    const { base } = adaptadorFalso([], [{ code: "P0401", status: "stored" }]);
    const p = new MercedesProvider({ base });
    expect(await p.dtc()).toEqual([{ code: "P0401", status: "stored" }]);
  });

  it("suma los códigos propietarios a los del motor", async () => {
    const { base } = adaptadorFalso(
      [{ address: 0x28, dtc: [[0xc1, 0x23, 0x60]] }],
      [{ code: "P0401", status: "stored" }],
    );
    const p = new MercedesProvider({ base, modules: [MODULO_ABS] });
    const codigos = await p.dtc();

    expect(codigos.map((c) => c.code)).toEqual(["P0401", "ABS-C123"]);
    // No se disfraza de código SAE: lleva el prefijo del módulo.
    expect(codigos[1]?.code).not.toMatch(/^C0/);
    expect(codigos[1]?.status).toBe("stored"); // bit de activo puesto
  });

  it("marca como pendiente un código no activo", async () => {
    const { base } = adaptadorFalso([{ address: 0x28, dtc: [[0xc1, 0x23, 0x40]] }]);
    const p = new MercedesProvider({ base, modules: [MODULO_ABS] });
    expect((await p.dtc())[0]?.status).toBe("pending");
  });

  it("enciende el testigo del subsistema afectado en la telemetría", async () => {
    const { base, emitir } = adaptadorFalso([{ address: 0x28, dtc: [[0xc1, 0x23, 0x60]] }]);
    const p = new MercedesProvider({ base, modules: [MODULO_ABS] });
    await p.dtc(); // primero se leen los módulos

    const recibidas: VehicleTelemetry[] = [];
    p.live((t) => recibidas.push(t));
    emitir();

    expect(recibidas[0]?.systems.abs).toBe("error");
    expect(recibidas[0]?.systems.engine).toBe("ok"); // el motor no se toca
  });

  it("abre sesión cuando la centralita la exige", async () => {
    const { base } = adaptadorFalso([
      { address: 0x38, dtc: [[0x45, 0x01, 0x60]], exigeSesion: true },
    ]);
    const p = new MercedesProvider({ base, modules: [MODULO_AIRBAG] });
    expect((await p.dtc()).map((c) => c.code)).toEqual(["SRS-4501"]);
  });

  it("reintenta mientras la centralita conteste 'respuesta pendiente'", async () => {
    const { base } = adaptadorFalso([
      { address: 0x28, dtc: [[0xc1, 0x23, 0x60]], ocupadaVeces: 2 },
    ]);
    const p = new MercedesProvider({ base, modules: [MODULO_ABS] });
    expect((await p.dtc()).map((c) => c.code)).toEqual(["ABS-C123"]);
  });

  it("una centralita muda no aborta la lectura de las demás", async () => {
    const { base } = adaptadorFalso([{ address: 0x28, dtc: [[0xc1, 0x23, 0x60]] }]);
    // El airbag (0x38) no existe en el adaptador falso.
    const p = new MercedesProvider({ base, modules: [MODULO_ABS, MODULO_AIRBAG] });

    expect((await p.dtc()).map((c) => c.code)).toEqual(["ABS-C123"]);
    expect(p.getModulosSinRespuesta()).toEqual(["Airbag"]);
  });

  it("una centralita muda deja su testigo en 'unknown', nunca en 'ok'", async () => {
    const { base, emitir } = adaptadorFalso([]);
    const p = new MercedesProvider({ base, modules: [MODULO_AIRBAG] });
    await p.dtc();

    const recibidas: VehicleTelemetry[] = [];
    p.live((t) => recibidas.push(t));
    emitir();

    // Lo importante: NO dice "ok" de algo que no ha podido comprobar.
    expect(recibidas[0]?.systems.airbag).toBe("unknown");
  });

  it("borra los códigos del motor y los de cada centralita", async () => {
    const { base } = adaptadorFalso([{ address: 0x28, dtc: [[0xc1, 0x23, 0x60]] }]);
    const p = new MercedesProvider({ base, modules: [MODULO_ABS] });

    expect(await p.dtc()).toHaveLength(1);
    await p.clearDtc();
    expect(await p.dtc()).toHaveLength(0);
  });

  it("descubre las centralitas que responden e ignora el resto", async () => {
    const { base } = adaptadorFalso([
      { address: 0x28, dtc: [[0xc1, 0x23, 0x60]] },
      { address: 0x38, dtc: [] },
    ]);
    const p = new MercedesProvider({ base });

    const hallados = await p.escanearModulos([0x10, 0x28, 0x30, 0x38, 0x40]);
    expect(hallados.map((m) => m.address)).toEqual([0x28, 0x38]);
    expect(hallados[0]?.codigos).toBe(1);
    expect(hallados[1]?.codigos).toBe(0);
  });

  it("pone el adaptador en ISO 14230 antes de hablar con las centralitas", async () => {
    const { base, comandos } = adaptadorFalso([{ address: 0x28, dtc: [] }]);
    const p = new MercedesProvider({ base, modules: [MODULO_ABS] });
    await p.dtc();

    expect(comandos).toContain("ATSP5"); // KWP2000 con inicialización rápida
    expect(comandos).toContain("ATH1"); // cabeceras, para saber quién responde
    expect(comandos).toContain("ATSH8128F1"); // dirigido a la centralita 0x28
  });
});
