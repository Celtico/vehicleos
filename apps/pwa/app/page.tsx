"use client";

/**
 * Cuadro principal, dimensionado para una tablet de 9" a 1280×720.
 *
 * La restricción manda: en una pantalla de coche NADA puede quedar debajo
 * del corte, porque nadie va a desplazarse conduciendo. Todo el contenido
 * cabe en el alto disponible, y por eso la disposición es densa.
 *
 * Reparto: velocidad y régimen a los lados, el coche al centro con sus
 * magnitudes encima, y abajo una fila con las averías activas, el estado
 * de los subsistemas y los datos del viaje.
 *
 * Solo se muestran magnitudes que el coche entrega de verdad. Presión de
 * aceite, presión de neumáticos, marcha engranada o estado de puertas no
 * salen por el OBD-II de este vehículo, y una pantalla de diagnóstico que
 * enseña números inventados es peor que una que no los enseña.
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FaultPanel,
  InfoList,
  MetricCard,
  RpmGauge,
  SpeedGauge,
  StatusLight,
  VehicleModel,
  type FaultItem,
  type VehiclePartId,
} from "@vehicleos/ui";
import { DEFAULT_PROFILE } from "@vehicleos/shared";
import { explainDtc, partsFromDtc, PART_LABELS } from "@vehicleos/ai";
import { useVehicleStore, type HistoryPoint } from "../store/vehicle-store";

/** Temperatura a la que el vano motor empieza a teñirse. */
const TEMP_FRIA = 70;
const TEMP_CALIENTE = 115;

/** Integra una serie de 1 Hz sobre el tiempo: Σ(valor · Δt) en horas. */
function integrar(serie: HistoryPoint[]): number {
  let total = 0;
  for (let i = 1; i < serie.length; i++) {
    const previo = serie[i - 1];
    const actual = serie[i];
    if (!previo || !actual) continue;
    const horas = (actual.t - previo.t) / 3_600_000;
    total += ((previo.v + actual.v) / 2) * horas;
  }
  return total;
}

export default function DashboardPage() {
  const router = useRouter();
  const t = useVehicleStore((s) => s.telemetry);
  const dtc = useVehicleStore((s) => s.dtc);
  const history = useVehicleStore((s) => s.history);
  const [piezaTocada, setPiezaTocada] = useState<VehiclePartId | null>(null);

  const parts = useMemo(() => partsFromDtc(dtc), [dtc]);

  const engineHeat = t
    ? Math.max(
        0,
        Math.min(100, ((t.coolantTemp - TEMP_FRIA) / (TEMP_CALIENTE - TEMP_FRIA)) * 100),
      )
    : 0;

  // Averías con su explicación en lenguaje llano.
  const faults: FaultItem[] = useMemo(
    () =>
      dtc.map((d) => {
        const info = explainDtc(d.code);
        return {
          code: d.code,
          title: info.title,
          severity: d.status === "stored" ? "error" : "warning",
        };
      }),
    [dtc],
  );

  /**
   * Datos del viaje desde que se conectó, calculados con las series reales:
   * distancia integrando la velocidad y consumo integrando el caudal.
   */
  const viaje = useMemo(() => {
    const km = integrar(history.speed);
    const litros = integrar(history.fuelRate);
    const primero = history.speed[0];
    const ultimo = history.speed[history.speed.length - 1];
    const minutos = primero && ultimo ? Math.round((ultimo.t - primero.t) / 60_000) : 0;
    const consumo = km > 0.3 ? (litros / km) * 100 : null;
    // Autonomía: lo que queda en el depósito al consumo medio del viaje.
    const litrosRestantes = ((t?.fuelLevel ?? 0) / 100) * DEFAULT_PROFILE.tankLiters;
    const autonomia = consumo && consumo > 0 ? (litrosRestantes / consumo) * 100 : null;

    return {
      distancia: km,
      consumo,
      minutos,
      autonomia,
      litrosRestantes,
    };
  }, [history.speed, history.fuelRate, t?.fuelLevel]);

  const fmt = (v: number | null, dec: number, unidad: string) =>
    v === null ? "—" : `${v.toFixed(dec)} ${unidad}`;

  return (
    <div className="flex h-full flex-col gap-2.5 p-3">
      {/* ── Fila principal: velocidad · coche · régimen ───────── */}
      <div className="flex min-h-0 flex-1 items-stretch gap-3">
        <div className="flex shrink-0 items-center">
          <SpeedGauge speed={t?.speed ?? 0} size={228} max={DEFAULT_PROFILE.maxSpeed} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          {/* Magnitudes que el coche sí entrega */}
          <div className="grid shrink-0 grid-cols-4 gap-2.5">
            <MetricCard
              label="Refrigerante"
              value={t?.coolantTemp ?? 0}
              unit="°C"
              max={130}
              danger={105}
            />
            <MetricCard
              label="Combustible"
              value={t?.fuelLevel ?? 0}
              unit="%"
              max={100}
              danger={10}
            />
            <MetricCard
              label="Batería"
              value={t?.batteryVoltage ?? 0}
              unit="V"
              min={8}
              max={16}
              decimals={1}
            />
            <MetricCard
              label="Turbo"
              value={t?.turboPressure ?? 0}
              unit="bar"
              max={DEFAULT_PROFILE.maxBoostBar ?? 1.4}
              decimals={2}
            />
          </div>

          {/* El coche, con la pieza averiada resaltada */}
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <VehicleModel
              size={196}
              parts={parts}
              engineHeat={engineHeat}
              onPartClick={(p) => setPiezaTocada(p === piezaTocada ? null : p)}
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center">
          <RpmGauge
            rpm={t?.rpm ?? 0}
            size={228}
            max={DEFAULT_PROFILE.maxRpm}
            redline={DEFAULT_PROFILE.redlineRpm}
          />
        </div>
      </div>

      {/* ── Fila inferior: averías · estado · viaje ───────────── */}
      <div className="grid h-[188px] shrink-0 grid-cols-3 gap-3">
        <FaultPanel
          faults={faults}
          onSelect={() => router.push("/diagnostics")}
          onSeeAll={() => router.push("/diagnostics")}
        />

        {/* Estado de los subsistemas, o el detalle de la pieza tocada */}
        <div className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <span className="mb-2 block text-[10px] uppercase tracking-[0.22em] text-accent">
            {piezaTocada ? PART_LABELS[piezaTocada] : "Estado de sistemas"}
          </span>

          {piezaTocada ? (
            <button
              onClick={() => router.push("/diagnostics")}
              className="flex flex-1 flex-col items-center justify-center gap-1 text-center"
            >
              <span className="text-sm text-silver">
                {parts[piezaTocada] === "error"
                  ? "Avería en esta pieza"
                  : parts[piezaTocada] === "warning"
                    ? "Aviso en esta pieza"
                    : "Sin averías en esta pieza"}
              </span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted">
                Toca para ver el diagnóstico
              </span>
            </button>
          ) : (
            <>
              <div className="flex flex-1 items-center justify-around">
                <StatusLight kind="engine" status={t?.systems.engine ?? "unknown"} />
                <StatusLight kind="abs" status={t?.systems.abs ?? "unknown"} />
                <StatusLight kind="esp" status={t?.systems.esp ?? "unknown"} />
                <StatusLight kind="airbag" status={t?.systems.airbag ?? "unknown"} />
              </div>
              <p className="text-center text-[10px] uppercase tracking-[0.2em] text-muted">
                {t?.engineRunning ? "Motor en marcha" : "Motor parado"} ·{" "}
                {(t?.odometer ?? 0).toFixed(0)} km
              </p>
            </>
          )}
        </div>

        <InfoList
          title="Viaje actual"
          rows={[
            { label: "Distancia", value: fmt(viaje.distancia, 1, "km") },
            { label: "Consumo medio", value: fmt(viaje.consumo, 1, "L/100km") },
            {
              label: "Tiempo",
              value:
                viaje.minutos >= 60
                  ? `${Math.floor(viaje.minutos / 60)} h ${viaje.minutos % 60} min`
                  : `${viaje.minutos} min`,
            },
            { label: "Autonomía", value: fmt(viaje.autonomia, 0, "km") },
            { label: "En depósito", value: fmt(viaje.litrosRestantes, 1, "L") },
          ]}
        />
      </div>
    </div>
  );
}
