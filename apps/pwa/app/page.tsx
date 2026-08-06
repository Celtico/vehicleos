"use client";

/**
 * Cuadro principal.
 *
 * El coche ocupa el centro y resalta la pieza averiada: los códigos de
 * avería ya identifican la esquina afectada (C0035 es el sensor de rueda
 * delantera izquierda), así que el modelo traduce el diagnóstico a algo
 * que se entiende de un vistazo, sin leer códigos.
 *
 * A los lados quedan los dos indicadores que se miran conduciendo
 * (velocidad y régimen) y, debajo, las gráficas de las magnitudes cuya
 * *tendencia* importa más que su valor instantáneo: si el refrigerante
 * sube despacio o el turbo ya no alcanza presión, se ve aquí.
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BatteryIndicator,
  Card,
  MBUX,
  RpmGauge,
  SpeedGauge,
  StatusLight,
  TelemetryTile,
  TimeSeriesChart,
  VehicleModel,
  type VehiclePartId,
} from "@vehicleos/ui";
import { DEFAULT_PROFILE } from "@vehicleos/shared";
import { partsFromDtc, PART_LABELS } from "@vehicleos/ai";
import { useVehicleStore, type CarView } from "../store/vehicle-store";
import { VehicleModel3DLazy } from "../components/VehicleModel3DLazy";

/** Temperatura a la que el vano motor empieza a teñirse. */
const TEMP_FRIA = 70;
const TEMP_CALIENTE = 115;

/** Opciones del conmutador de representación del coche. */
const VISTAS: readonly { id: CarView; etiqueta: string }[] = [
  { id: "top", etiqueta: "Cenital" },
  { id: "3d", etiqueta: "3D" },
];

/**
 * Conmutador cenital / 3D. Discreto a propósito: es una preferencia, no un
 * mando de conducción, así que no debe competir con los indicadores.
 */
function ConmutadorVista({
  vista,
  onChange,
}: {
  vista: CarView;
  onChange: (v: CarView) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Representación del vehículo"
      className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-0.5"
    >
      {VISTAS.map((v) => {
        const activa = vista === v.id;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onChange(v.id)}
            aria-pressed={activa}
            className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.25em] transition-colors ${
              activa
                ? "bg-accent/15 text-accent"
                : "text-muted hover:text-silver focus-visible:text-silver"
            }`}
          >
            {v.etiqueta}
          </button>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const t = useVehicleStore((s) => s.telemetry);
  const dtc = useVehicleStore((s) => s.dtc);
  const history = useVehicleStore((s) => s.history);
  const carView = useVehicleStore((s) => s.carView);
  const setCarView = useVehicleStore((s) => s.setCarView);
  const [piezaTocada, setPiezaTocada] = useState<VehiclePartId | null>(null);

  // Traducción de averías a piezas resaltadas del modelo.
  const parts = useMemo(() => partsFromDtc(dtc), [dtc]);

  // El calor del vano motor se normaliza entre frío y sobrecalentado.
  const engineHeat = t
    ? Math.max(
        0,
        Math.min(100, ((t.coolantTemp - TEMP_FRIA) / (TEMP_CALIENTE - TEMP_FRIA)) * 100),
      )
    : 0;

  // Averías asociadas a la pieza que el conductor acaba de tocar.
  const averiasDePieza = useMemo(() => {
    if (!piezaTocada) return [];
    return dtc.filter((d) => (parts[piezaTocada] ? partsFromDtc([d])[piezaTocada] : false));
  }, [piezaTocada, dtc, parts]);

  return (
    <div className="flex h-full min-h-[640px] flex-col gap-4 p-5">
      {/* Fila principal: velocidad · coche · régimen */}
      <div className="flex flex-1 flex-wrap items-center justify-center gap-4">
        <SpeedGauge speed={t?.speed ?? 0} size={272} max={DEFAULT_PROFILE.maxSpeed} />

        <div className="flex w-[320px] flex-col items-center gap-2">
          {carView === "3d" ? (
            <div className="w-full">
              <VehicleModel3DLazy
                height={424}
                parts={parts}
                engineHeat={engineHeat}
                onPartClick={(p) => setPiezaTocada(p === piezaTocada ? null : p)}
              />
            </div>
          ) : (
            <VehicleModel
              size={300}
              parts={parts}
              engineHeat={engineHeat}
              onPartClick={(p) => setPiezaTocada(p === piezaTocada ? null : p)}
            />
          )}

          <ConmutadorVista vista={carView} onChange={setCarView} />

          {/* Detalle de la pieza tocada, o testigos si no hay ninguna. */}
          {piezaTocada ? (
            <button
              onClick={() => router.push("/diagnostics")}
              className="max-w-[320px] rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-left transition-colors hover:border-accent/40"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-accent">
                {PART_LABELS[piezaTocada]}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {averiasDePieza.length > 0
                  ? `${averiasDePieza.map((d) => d.code).join(", ")} · toca para ver el diagnóstico`
                  : "Sin averías en esta pieza"}
              </p>
            </button>
          ) : (
            <div className="flex flex-row gap-5">
              <StatusLight kind="engine" status={t?.systems.engine ?? "unknown"} />
              <StatusLight kind="abs" status={t?.systems.abs ?? "unknown"} />
              <StatusLight kind="esp" status={t?.systems.esp ?? "unknown"} />
              <StatusLight kind="airbag" status={t?.systems.airbag ?? "unknown"} />
            </div>
          )}

          <div className="flex items-center gap-3">
            <BatteryIndicator
              voltage={t?.batteryVoltage ?? 12.4}
              engineRunning={t?.engineRunning ?? false}
            />
            <span className="text-[10px] uppercase tracking-[0.25em] text-muted">
              {t?.engineRunning ? "Motor en marcha" : "Motor parado"}
            </span>
          </div>
        </div>

        <RpmGauge
          rpm={t?.rpm ?? 0}
          size={272}
          max={DEFAULT_PROFILE.maxRpm}
          redline={DEFAULT_PROFILE.redlineRpm}
        />
      </div>

      {/* Gráficas: lo que importa es la tendencia, no el número suelto. */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <TimeSeriesChart
            points={history.coolant}
            label="Refrigerante"
            unit="°C"
            min={0}
            max={130}
            height={110}
            zones={[
              { from: 105, to: 115, color: MBUX.warning },
              { from: 115, to: 130, color: MBUX.danger },
            ]}
            format={(v) => v.toFixed(0)}
          />
        </Card>
        <Card>
          <TimeSeriesChart
            points={history.boost}
            label="Turbo"
            unit="bar"
            min={0}
            max={DEFAULT_PROFILE.maxBoostBar ?? 1.4}
            height={110}
            format={(v) => v.toFixed(2)}
          />
        </Card>
        <Card>
          <TimeSeriesChart
            points={history.voltage}
            label="Tensión"
            unit="V"
            min={10}
            max={15.5}
            height={110}
            zones={[{ from: 10, to: 11.8, color: MBUX.danger }]}
            format={(v) => v.toFixed(1)}
          />
        </Card>
      </div>

      {/* Fila de métricas instantáneas */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TelemetryTile label="Consumo" value={t?.fuelRate ?? 0} unit="L/h" decimals={1} />
        <TelemetryTile label="Combustible" value={t?.fuelLevel ?? 0} unit="%" />
        <TelemetryTile label="Carga motor" value={t?.engineLoad ?? 0} unit="%" />
        <TelemetryTile label="Odómetro" value={t?.odometer ?? 0} unit="km" />
      </div>
    </div>
  );
}
