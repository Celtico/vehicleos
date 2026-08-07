/**
 * Store global del vehículo (Zustand).
 *
 * Gestiona el VehicleProvider actual (simulador por defecto), se conecta,
 * se suscribe UNA sola vez a live() y publica la última VehicleTelemetry,
 * los DTC y el ConnectionState. Los gauges leen de aquí y animan
 * internamente con rAF (lo hace @vehicleos/ui).
 *
 * REGLA DE SEGURIDAD: la PWA jamás toca Bluetooth/hardware. Toda fuente
 * de datos pasa por @vehicleos/vehicle-sdk (el único con acceso, vía el
 * bridge Android en el caso real).
 */
import { create } from "zustand";
import type {
  ConnectionState,
  DiagnosticTroubleCode,
  GeoPoint,
  VehicleTelemetry,
} from "@vehicleos/shared";
import {
  createVehicleProvider,
  SimulatorProvider,
  type ProviderKind,
  type VehicleProvider,
} from "@vehicleos/vehicle-sdk";
import type { ScenarioId } from "@vehicleos/vehicle-simulator";
import { TelemetryClient, type TelemetryLinkState } from "@vehicleos/telemetry";
import { createKeyValueStore, createOfflineQueue } from "@vehicleos/storage";
import { DEFAULT_API_URL, DEFAULT_SOCKET_PATH, DEFAULT_WS_URL, VEHICLE_ID } from "../lib/env";

/** Muestras retenidas para las gráficas: 5 minutos a 1 Hz. */
const MAX_HISTORY = 300;
/** Periodo de muestreo del histórico en ms (1 Hz basta para una gráfica). */
const HISTORY_INTERVAL_MS = 1000;

/** Máximo de puntos GPS retenidos para el mapa. */
const MAX_PATH_POINTS = 3000;
/** Distancia mínima (grados aprox.) para registrar un punto nuevo de ruta. */
const MIN_PATH_DELTA = 0.00008; // ~9 m

/** Clave de los ajustes persistidos en IndexedDB. */
const SETTINGS_KEY = "cockpit-settings";

/**
 * Ajustes que sobreviven a un reinicio.
 *
 * Importa en un coche: la pantalla puede reiniciarse (corte de contacto,
 * relanzamiento de la PWA) y el conductor no debe reconfigurar el provider,
 * el backend ni el envío de telemetría en cada arranque.
 */
interface PersistedSettings {
  kind: ProviderKind;
  scenario: ScenarioId;
  telemetryEnabled: boolean;
  apiUrl: string;
  wsUrl: string;
  /** JWT del backend (se obtiene con /auth/login). */
  authToken: string;
  /** Id del vehículo al que pertenece esta telemetría en el backend. */
  vehicleId: string;
}

// Recursos no serializables fuera del estado reactivo.
let unsubscribeLive: (() => void) | null = null;
let telemetryClient: TelemetryClient | null = null;
let lastDtcCheck = 0;
let lastHistorySample = 0;
const settingsStore = createKeyValueStore();

/** Serie temporal simple para las gráficas del cuadro. */
export interface HistoryPoint {
  t: number;
  v: number;
}

export interface TelemetryHistory {
  coolant: HistoryPoint[];
  boost: HistoryPoint[];
  voltage: HistoryPoint[];
  speed: HistoryPoint[];
  /** Consumo instantáneo en L/h; con la velocidad da el consumo del viaje. */
  fuelRate: HistoryPoint[];
}

export interface VehicleStore {
  /** Tipo de provider activo. */
  kind: ProviderKind;
  /** Instancia actual del provider (solo se usa vía acciones). */
  provider: VehicleProvider | null;
  connection: ConnectionState;
  telemetry: VehicleTelemetry | null;
  dtc: DiagnosticTroubleCode[];
  /** Ruta GPS acumulada del stream en vivo (para /map). */
  path: GeoPoint[];
  /**
   * Histórico reciente para las gráficas (5 min a 1 Hz).
   * Se muestrea aparte del stream porque los gauges van a 20 Hz y una
   * gráfica no necesita esa resolución.
   */
  history: TelemetryHistory;
  scenario: ScenarioId;
  engineOn: boolean;
  /** Envío de telemetría al backend. */
  telemetryEnabled: boolean;
  telemetryLink: TelemetryLinkState;
  apiUrl: string;
  wsUrl: string;
  /** JWT con el que se autentica el envío de telemetría. */
  authToken: string;
  /** Id del vehículo en el backend (debe existir y ser del usuario del token). */
  vehicleId: string;

  /**
   * Restaura los ajustes guardados y conecta. Es el arranque del cockpit:
   * llámalo una sola vez desde el cliente (ver components/Providers.tsx).
   */
  boot(): Promise<void>;
  /** Conecta el provider indicado (o el actual). Suscripción única a live(). */
  connect(kind?: ProviderKind): Promise<void>;
  disconnect(): Promise<void>;
  setScenario(id: ScenarioId): void;
  startEngine(): void;
  stopEngine(): void;
  refreshDtc(): Promise<void>;
  clearDtc(): Promise<void>;
  setTelemetryEnabled(enabled: boolean): void;
  setApiUrl(url: string): void;
  setWsUrl(url: string): void;
  setAuthToken(token: string): void;
  setVehicleId(id: string): void;
  clearPath(): void;
}

export const useVehicleStore = create<VehicleStore>((set, get) => ({
  kind: "simulator",
  provider: null,
  connection: "disconnected",
  telemetry: null,
  dtc: [],
  path: [],
  history: { coolant: [], boost: [], voltage: [], speed: [], fuelRate: [] },
  scenario: "city",
  engineOn: false,
  telemetryEnabled: false,
  telemetryLink: "idle",
  apiUrl: DEFAULT_API_URL,
  wsUrl: DEFAULT_WS_URL,
  authToken: "",
  vehicleId: VEHICLE_ID,

  async boot() {
    try {
      const saved = await settingsStore.get<PersistedSettings>(SETTINGS_KEY);
      if (saved) {
        set({
          kind: saved.kind,
          scenario: saved.scenario,
          apiUrl: saved.apiUrl,
          wsUrl: saved.wsUrl,
          authToken: saved.authToken ?? "",
          vehicleId: saved.vehicleId || VEHICLE_ID,
          // El envío se rearma tras conectar, no antes (necesita provider).
          telemetryEnabled: false,
        });
        await get().connect(saved.kind);
        if (saved.telemetryEnabled) get().setTelemetryEnabled(true);
        return;
      }
    } catch {
      // Ajustes corruptos o IndexedDB no disponible: se arranca por defecto.
    }
    await get().connect();
  },

  async connect(kind) {
    const nextKind = kind ?? get().kind;

    // Desconexión limpia del provider anterior.
    await get().disconnect();

    const provider = createVehicleProvider(nextKind, {
      simulator: { scenario: get().scenario },
    });
    set({ kind: nextKind, provider, connection: "connecting" });
    persistSettings();

    try {
      await provider.connect();
    } catch {
      set({ connection: "error" });
      return;
    }

    // Suscripción ÚNICA al stream en vivo.
    unsubscribeLive = provider.live((t) => {
      const state = get();

      // Acumula la ruta GPS con umbral de distancia.
      let path = state.path;
      if (t.location) {
        const last = path[path.length - 1];
        if (
          !last ||
          Math.abs(last.lat - t.location.lat) > MIN_PATH_DELTA ||
          Math.abs(last.lon - t.location.lon) > MIN_PATH_DELTA
        ) {
          path = [...path.slice(-MAX_PATH_POINTS + 1), t.location];
        }
      }

      // Histórico a 1 Hz para las gráficas.
      let history = state.history;
      if (t.timestamp - lastHistorySample >= HISTORY_INTERVAL_MS) {
        lastHistorySample = t.timestamp;
        const push = (serie: HistoryPoint[], v: number): HistoryPoint[] => [
          ...serie.slice(-MAX_HISTORY + 1),
          { t: t.timestamp, v },
        ];
        history = {
          coolant: push(history.coolant, t.coolantTemp),
          boost: push(history.boost, t.turboPressure),
          voltage: push(history.voltage, t.batteryVoltage),
          speed: push(history.speed, t.speed),
          fuelRate: push(history.fuelRate, t.fuelRate),
        };
      }

      set({ telemetry: t, engineOn: t.engineRunning, path, history });

      // Revisión periódica de DTC (llamada local barata, cada 2 s).
      if (t.timestamp - lastDtcCheck > 2000) {
        lastDtcCheck = t.timestamp;
        void state.refreshDtc();
      }
    });

    set({ connection: provider.state() });
    await get().refreshDtc();

    // Rearma el envío de telemetría si estaba activo.
    if (get().telemetryEnabled) {
      get().setTelemetryEnabled(false);
      get().setTelemetryEnabled(true);
    }
  },

  async disconnect() {
    const { provider } = get();
    if (telemetryClient) {
      telemetryClient.stop();
      telemetryClient = null;
      set({ telemetryLink: "idle" });
    }
    if (unsubscribeLive) {
      unsubscribeLive();
      unsubscribeLive = null;
    }
    if (provider) {
      try {
        await provider.disconnect();
      } catch {
        // La desconexión nunca debe romper la UI.
      }
    }
    set({ provider: null, connection: "disconnected", engineOn: false });
  },

  setScenario(id) {
    set({ scenario: id });
    persistSettings();
    const { provider } = get();
    if (provider instanceof SimulatorProvider) {
      provider.getSimulator().setScenario(id);
      void get().refreshDtc();
    }
  },

  startEngine() {
    const { provider, scenario } = get();
    if (provider instanceof SimulatorProvider) {
      provider.getSimulator().start(scenario);
      set({ engineOn: true });
    }
  },

  stopEngine() {
    const { provider } = get();
    if (provider instanceof SimulatorProvider) {
      const sim = provider.getSimulator();
      sim.stop();
      // El bucle del simulador se detiene: publica la instantánea final.
      set({ engineOn: false, telemetry: sim.getTelemetry() });
    }
  },

  async refreshDtc() {
    const { provider } = get();
    if (!provider || provider.state() !== "connected") return;
    try {
      const list = await provider.dtc();
      const current = get().dtc;
      const changed =
        list.length !== current.length ||
        list.some((d, i) => current[i]?.code !== d.code || current[i]?.status !== d.status);
      if (changed) set({ dtc: list });
    } catch {
      // Ignorado: el provider puede estar reconectando.
    }
  },

  async clearDtc() {
    const { provider } = get();
    if (!provider) return;
    await provider.clearDtc();
    await get().refreshDtc();
  },

  setTelemetryEnabled(enabled) {
    if (!enabled) {
      telemetryClient?.stop();
      telemetryClient = null;
      set({ telemetryEnabled: false, telemetryLink: "idle" });
      persistSettings();
      return;
    }
    const { provider, wsUrl, authToken, vehicleId } = get();
    if (!provider) return;
    telemetryClient = new TelemetryClient({
      provider,
      vehicleId,
      url: wsUrl,
      token: authToken || undefined,
      ...(DEFAULT_SOCKET_PATH ? { socketPath: DEFAULT_SOCKET_PATH } : {}),
      queue: createOfflineQueue(),
      onStateChange: (link) => set({ telemetryLink: link }),
    });
    telemetryClient.start();
    set({ telemetryEnabled: true });
    persistSettings();
  },

  setApiUrl(url) {
    set({ apiUrl: url });
    persistSettings();
  },

  setAuthToken(token) {
    set({ authToken: token });
    persistSettings();
    if (get().telemetryEnabled) {
      get().setTelemetryEnabled(false);
      get().setTelemetryEnabled(true);
    }
  },

  setVehicleId(id) {
    set({ vehicleId: id });
    persistSettings();
    if (get().telemetryEnabled) {
      get().setTelemetryEnabled(false);
      get().setTelemetryEnabled(true);
    }
  },

  setWsUrl(url) {
    set({ wsUrl: url });
    persistSettings();
    // Si el envío está activo, se rearma con la nueva URL.
    if (get().telemetryEnabled) {
      get().setTelemetryEnabled(false);
      get().setTelemetryEnabled(true);
    }
  },

  clearPath() {
    set({
      path: [],
      history: { coolant: [], boost: [], voltage: [], speed: [], fuelRate: [] },
    });
  },
}));

/**
 * Guarda los ajustes actuales. Se llama en cada cambio; los fallos se
 * ignoran a propósito: no poder persistir nunca debe romper el cockpit.
 */
function persistSettings(): void {
  const s = useVehicleStore.getState();
  const settings: PersistedSettings = {
    kind: s.kind,
    scenario: s.scenario,
    telemetryEnabled: s.telemetryEnabled,
    apiUrl: s.apiUrl,
    wsUrl: s.wsUrl,
    authToken: s.authToken,
    vehicleId: s.vehicleId,
  };
  void settingsStore.set(SETTINGS_KEY, settings).catch(() => undefined);
}
