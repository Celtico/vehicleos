"use client";

/**
 * Ajustes: selector de provider (los futuros aparecen deshabilitados como
 * "próximamente"), escenario del simulador, arranque/parada del motor,
 * URLs del backend y envío de telemetría (@vehicleos/telemetry).
 *
 * REGLA DE SEGURIDAD: la PWA jamás toca Bluetooth ni hardware; cualquier
 * fuente real de datos llega siempre a través de @vehicleos/vehicle-sdk.
 */
import { SCENARIOS, type ScenarioId } from "@vehicleos/vehicle-simulator";
import type { ProviderKind } from "@vehicleos/vehicle-sdk";
import { Card } from "@vehicleos/ui";
import { useVehicleStore } from "../../store/vehicle-store";

interface ProviderOption {
  kind: ProviderKind;
  name: string;
  detail: string;
  available: boolean;
}

const PROVIDERS: ProviderOption[] = [
  {
    kind: "simulator",
    name: "Simulador",
    detail: "Vehículo virtual con escenarios de conducción y averías",
    available: true,
  },
  {
    kind: "android-bridge",
    name: "Android Bridge",
    detail: "Adaptador OBD-II real vía servicio Android (WebSocket local)",
    available: true,
  },
  { kind: "can", name: "CAN directo", detail: "Lectura directa del bus CAN", available: false },
  { kind: "thinkdiag", name: "ThinkDiag", detail: "Adaptador ThinkDiag", available: false },
  { kind: "xtool", name: "XTool", detail: "Adaptador XTool", available: false },
  { kind: "mercedes", name: "Mercedes", detail: "Protocolo propietario", available: false },
];

const SCENARIO_IDS = Object.keys(SCENARIOS) as ScenarioId[];

const LINK_LABEL: Record<string, string> = {
  idle: "Inactivo",
  connecting: "Conectando…",
  open: "Enviando",
  closed: "Sin conexión (encolando)",
};

export default function SettingsPage() {
  const kind = useVehicleStore((s) => s.kind);
  const connect = useVehicleStore((s) => s.connect);
  const scenario = useVehicleStore((s) => s.scenario);
  const setScenario = useVehicleStore((s) => s.setScenario);
  const engineOn = useVehicleStore((s) => s.engineOn);
  const startEngine = useVehicleStore((s) => s.startEngine);
  const stopEngine = useVehicleStore((s) => s.stopEngine);
  const apiUrl = useVehicleStore((s) => s.apiUrl);
  const setApiUrl = useVehicleStore((s) => s.setApiUrl);
  const wsUrl = useVehicleStore((s) => s.wsUrl);
  const setWsUrl = useVehicleStore((s) => s.setWsUrl);
  const telemetryEnabled = useVehicleStore((s) => s.telemetryEnabled);
  const setTelemetryEnabled = useVehicleStore((s) => s.setTelemetryEnabled);
  const telemetryLink = useVehicleStore((s) => s.telemetryLink);
  const authToken = useVehicleStore((s) => s.authToken);
  const setAuthToken = useVehicleStore((s) => s.setAuthToken);
  const backendVehicleId = useVehicleStore((s) => s.vehicleId);
  const setVehicleId = useVehicleStore((s) => s.setVehicleId);

  return (
    <div className="flex flex-col gap-5 p-6">
      <h1 className="text-xl font-medium tracking-[0.2em] text-silver">AJUSTES</h1>

      {/* Fuente de datos */}
      <Card title="Fuente de datos del vehículo">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {PROVIDERS.map((p) => {
            const active = p.kind === kind;
            return (
              <button
                key={p.kind}
                disabled={!p.available}
                onClick={() => void connect(p.kind)}
                className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                  active
                    ? "border-accent/60 bg-accent/10"
                    : p.available
                      ? "border-linea/10 bg-linea/[0.03] hover:border-accent/30"
                      : "cursor-not-allowed border-linea/5 bg-linea/[0.02] opacity-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${active ? "text-accent" : "text-silver"}`}>
                    {p.name}
                  </span>
                  {!p.available ? (
                    <span className="rounded-full bg-linea/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted">
                      Próximamente
                    </span>
                  ) : active ? (
                    <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_6px_#00d2be]" />
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted">{p.detail}</p>
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-muted">
          Seguridad: esta PWA nunca accede a Bluetooth ni al hardware del vehículo. Todas las
          fuentes de datos pasan por <span className="text-silver">@vehicleos/vehicle-sdk</span>
          ; en el caso real, el único proceso que toca el adaptador OBD es el servicio Android
          (Vehicle Bridge).
        </p>
      </Card>

      {/* Simulador */}
      {kind === "simulator" ? (
        <Card title="Simulador">
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-muted">
                Escenario
              </label>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {SCENARIO_IDS.map((id) => {
                  const def = SCENARIOS[id];
                  const active = id === scenario;
                  return (
                    <button
                      key={id}
                      onClick={() => setScenario(id)}
                      className={`rounded-xl border px-4 py-2.5 text-left transition-colors ${
                        active
                          ? "border-accent/60 bg-accent/10"
                          : "border-linea/10 bg-linea/[0.03] hover:border-accent/30"
                      }`}
                    >
                      <span className={`text-sm ${active ? "text-accent" : "text-silver"}`}>
                        {def.name}
                      </span>
                      <p className="mt-0.5 text-xs text-muted">{def.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={engineOn ? stopEngine : startEngine}
                className={`rounded-lg border px-5 py-2.5 text-xs uppercase tracking-widest transition-colors ${
                  engineOn
                    ? "border-danger/50 text-danger hover:bg-danger/10"
                    : "border-okgreen/50 text-okgreen hover:bg-okgreen/10"
                }`}
              >
                {engineOn ? "Parar motor" : "Arrancar motor"}
              </button>
              <span className="text-xs text-muted">
                {engineOn ? "Motor en marcha" : "Motor parado"}
              </span>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Backend y telemetría */}
      <Card title="Backend y telemetría">
        <div className="flex max-w-xl flex-col gap-4">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-muted">
              URL del backend (API)
            </label>
            <input
              className="cockpit-input"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://localhost:3001"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-muted">
              URL del WebSocket de telemetría
            </label>
            <input
              className="cockpit-input"
              value={wsUrl}
              onChange={(e) => setWsUrl(e.target.value)}
              placeholder="ws://localhost:3001/telemetry"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-muted">
              Token de acceso (JWT)
            </label>
            <input
              className="cockpit-input"
              type="password"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              placeholder="Obtenido con POST /auth/login"
            />
            <p className="mt-1 text-xs text-muted">
              Sin token el backend rechaza la conexión: cada coche pertenece a un usuario.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-muted">
              Id del vehículo en el backend
            </label>
            <input
              className="cockpit-input"
              value={backendVehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              placeholder="Id devuelto por POST /vehicles"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-linea/10 bg-linea/[0.03] px-4 py-3">
            <div>
              <p className="text-sm text-silver">Enviar telemetría al backend</p>
              <p className="text-xs text-muted">
                Lotes de 5 muestras a 1 Hz por WebSocket; si cae, se encola en IndexedDB y se
                reenvía al reconectar. Estado: {LINK_LABEL[telemetryLink] ?? telemetryLink}
              </p>
            </div>
            <button
              role="switch"
              aria-checked={telemetryEnabled}
              onClick={() => setTelemetryEnabled(!telemetryEnabled)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                telemetryEnabled ? "bg-accent/70" : "bg-linea/15"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-silver transition-all ${
                  telemetryEnabled ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </div>
        </div>
      </Card>

      {/*
        Atribución obligatoria por la licencia del modelo 3D (CC BY-NC-SA):
        acreditar al autor allí donde se use. Ver public/models/ATRIBUCION.md.
      */}
      <p className="max-w-3xl text-[11px] leading-relaxed text-muted">
        Vista 3D del vehículo:{" "}
        <a
          href="https://sketchfab.com/3d-models/2003-mercedes-benz-clk-55-amg-96c1c8f27333453db1cde651bc089708"
          target="_blank"
          rel="noreferrer"
          className="text-silver underline decoration-linea/30 underline-offset-2 hover:text-accent"
        >
          «2003 Mercedes-Benz CLK 55 AMG»
        </a>{" "}
        de <span className="text-silver">Ddiaz Design</span>, publicado en Sketchfab bajo
        licencia{" "}
        <a
          href="https://creativecommons.org/licenses/by-nc-sa/4.0/"
          target="_blank"
          rel="noreferrer"
          className="text-silver underline decoration-linea/30 underline-offset-2 hover:text-accent"
        >
          CC BY-NC-SA 4.0
        </a>
        . El modelo se usa sin modificar; las piezas que no se ven desde fuera solo se ocultan
        al dibujar.
      </p>
    </div>
  );
}
