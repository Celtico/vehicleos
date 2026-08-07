"use client";

/**
 * Cuadro principal, dimensionado para una tablet de 9" a 1280×720.
 *
 * La restricción manda: en una pantalla de coche NADA puede quedar debajo
 * del corte, porque nadie va a desplazarse conduciendo. Todo el contenido
 * cabe en el alto disponible, y por eso la disposición es densa.
 *
 * Reparto: velocidad y régimen grandes a los lados, cada uno con su dato
 * asociado debajo (limitador y consumo); el coche al centro con las cinco
 * magnitudes encima; y abajo las averías activas, el mapa del coche que
 * dice dónde caen, los testigos y el viaje.
 *
 * Solo se muestran magnitudes que el coche entrega de verdad. Presión de
 * aceite, presión de neumáticos, marcha engranada o estado de puertas no
 * salen por el OBD-II de este vehículo, y una pantalla de diagnóstico que
 * enseña números inventados es peor que una que no los enseña.
 */
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  FaultPanel,
  MetricInline,
  RpmGauge,
  SpeedGauge,
  StatusLight,
  VehicleModel,
  type FaultItem,
  type VehiclePartId,
} from "@vehicleos/ui";
import { DEFAULT_PROFILE } from "@vehicleos/shared";
import { explainDtc, partsFromDtc } from "@vehicleos/ai";
import { VehicleModel3DLazy } from "../components/VehicleModel3DLazy";
import { useVehicleStore, type CarView, type HistoryPoint } from "../store/vehicle-store";

/** Alto reservado al vehículo en el centro del cuadro (cenital y 3D). */
const ALTO_VEHICULO = 262;

/** Opciones del conmutador de vista del coche. */
const VISTAS: { id: CarView; etiqueta: string }[] = [
  { id: "top", etiqueta: "Cenital" },
  { id: "3d", etiqueta: "3D" },
];

/**
 * Franja de temperatura en la que se tiñe el vano motor.
 *
 * Arranca en 100 °C y no en 70: un OM612 trabaja entre 85 y 95 °C, así que
 * empezar a los 70 pintaba el capó de ámbar con el motor simplemente en
 * temperatura de servicio. El tinte tiene que decir "esto no es normal", y
 * lo anormal empieza cerca del umbral de aviso por sobrecalentamiento
 * (105 °C, el mismo que usan las reglas del backend).
 */
const TEMP_FRIA = 100;
const TEMP_CALIENTE = 118;

/**
 * Velocidad del limitador. De momento es un aviso fijo y no un ajuste: el
 * coche no tiene limitador que se pueda mandar por el OBD, así que esto es
 * solo el umbral con el que la pantalla avisa.
 */
const LIMITADOR_KMH = 120;

/** Trazo común de los iconos de las magnitudes. */
const trazo = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

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
  const carView = useVehicleStore((s) => s.carView);
  const setCarView = useVehicleStore((s) => s.setCarView);
  const parts = useMemo(() => partsFromDtc(dtc), [dtc]);

  /** Tocar una pieza averiada abre su diagnóstico; una sana no hace nada. */
  const abrirPieza = (pieza: VehiclePartId) => {
    if ((parts[pieza] ?? "ok") !== "ok") router.push("/diagnostics");
  };

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

    return { distancia: km, consumo, minutos, autonomia, litrosRestantes };
  }, [history.speed, history.fuelRate, t?.fuelLevel]);

  /**
   * Consumo instantáneo, el de la caja junto al cuentavueltas.
   *
   * No es el mismo dato que el consumo medio del viaje: se calculaba igual y
   * salían los dos números idénticos en dos sitios de la pantalla. Parado, los
   * L/100km no existen (dividir por velocidad cero), así que se enseña el
   * caudal en L/h, que es lo que hace cualquier ordenador de a bordo.
   */
  const instantaneo = useMemo(() => {
    const caudal = t?.fuelRate ?? 0;
    const v = t?.speed ?? 0;
    if (!t?.engineRunning) return { valor: null, unidad: "L/100km" };
    if (v < 5) return { valor: caudal, unidad: "L/h" };
    return { valor: (caudal / v) * 100, unidad: "L/100km" };
  }, [t?.fuelRate, t?.speed, t?.engineRunning]);

  const fmt = (v: number | null, dec: number) => (v === null ? "—" : v.toFixed(dec));

  const tiempo =
    viaje.minutos >= 60
      ? `${Math.floor(viaje.minutos / 60)}:${String(viaje.minutos % 60).padStart(2, "0")}`
      : `0:${String(viaje.minutos).padStart(2, "0")}`;

  return (
    <div className="flex h-full flex-col gap-2 px-4 pb-1 pt-4">
      {/* ── Fila principal: velocidad · coche · régimen ───────── */}
      <div className="flex min-h-0 flex-1 items-stretch gap-2">
        {/* Velocímetro, con el limitador debajo */}
        <div className="flex shrink-0 flex-col items-center justify-center gap-1.5">
          <SpeedGauge speed={t?.speed ?? 0} size={300} max={DEFAULT_PROFILE.maxSpeed} />
          <div className="encaje-suave flex items-center gap-3 rounded-xl px-4 py-1.5">
            <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 text-accent" {...trazo}>
              <circle cx="12" cy="13.5" r="7" />
              <path d="M12 10v3.5l2.2 1.2M9.5 3.5h5" />
            </svg>
            <span className="flex flex-col leading-tight">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
                Limitador
              </span>
              <span className="flex items-baseline gap-1">
                <span className="text-lg font-bold tabular-nums text-silver">
                  {LIMITADOR_KMH}
                </span>
                <span className="text-[10px] text-muted">km/h</span>
              </span>
            </span>
          </div>
        </div>

        {/* Magnitudes y coche */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="grid shrink-0 grid-cols-5 gap-3 px-1 pt-1">
            <MetricInline
              label="Temp. motor"
              value={t?.coolantTemp ?? 0}
              unit="°C"
              max={130}
              warn={100}
              danger={105}
              icon={
                <svg viewBox="0 0 24 24" className="h-[30px] w-[30px]" {...trazo}>
                  <path d="M10 13.5V5a2 2 0 1 1 4 0v8.5a4 4 0 1 1-4 0z" />
                </svg>
              }
            />
            <MetricInline
              label="Carga motor"
              value={t?.engineLoad ?? 0}
              unit="%"
              max={100}
              icon={
                <svg viewBox="0 0 24 24" className="h-[30px] w-[30px]" {...trazo}>
                  <path d="M3 14.5v-3.2h1.9V9.1h2.4V6.8h4.6v2.3h2.3l2.3 2.2H21v4.6h-1.9v2.3h-2.4v-2.3h-6.1l-2.3 2.3H6v-2.3H3z" />
                </svg>
              }
            />
            <MetricInline
              label="Combustible"
              value={t?.fuelLevel ?? 0}
              unit="%"
              max={100}
              warnBelow={15}
              dangerBelow={10}
              icon={
                <svg viewBox="0 0 24 24" className="h-[30px] w-[30px]" {...trazo}>
                  <path d="M5 20V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v15M3.5 20h11M13 10.5h3a2 2 0 0 1 2 2v3.5a1.5 1.5 0 0 0 3 0V9l-2.5-2.5" />
                </svg>
              }
            />
            <MetricInline
              label="Batería"
              value={t?.batteryVoltage ?? 0}
              unit="V"
              min={8}
              max={16}
              warnBelow={12.2}
              dangerBelow={11.8}
              decimals={1}
              icon={
                <svg viewBox="0 0 24 24" className="h-[30px] w-[30px]" {...trazo}>
                  <rect x="3" y="8" width="18" height="10" rx="2" />
                  <path d="M7 5.5v2.5M17 5.5v2.5M6.5 13h3M13 13h3M14.5 11.5v3" />
                </svg>
              }
            />
            <MetricInline
              label="Turbo"
              value={t?.turboPressure ?? 0}
              unit="bar"
              max={DEFAULT_PROFILE.maxBoostBar ?? 1.4}
              decimals={2}
              icon={
                <svg viewBox="0 0 24 24" className="h-[30px] w-[30px]" {...trazo}>
                  <circle cx="10.5" cy="13.5" r="5" />
                  <path d="M10.5 13.5 15 9M15.5 5.5h3.5V9" />
                </svg>
              }
            />
          </div>

          {/* El coche, con la pieza averiada resaltada */}
          <div className="relative flex min-h-0 flex-1 items-center justify-center">
            {/* Conmutador de vista: discreto, arriba a la derecha, sin
                robarle alto al coche (va superpuesto). */}
            <div
              role="group"
              aria-label="Vista del vehículo"
              className="panel-cockpit absolute bottom-0 right-0 z-10 flex items-center gap-0.5 rounded-full p-0.5"
            >
              {VISTAS.map((v) => {
                const activa = v.id === carView;
                return (
                  <button
                    key={v.id}
                    onClick={() => setCarView(v.id)}
                    aria-pressed={activa}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors ${
                      activa ? "bg-accent/15 text-accent" : "text-muted hover:text-silver"
                    }`}
                  >
                    {v.etiqueta}
                  </button>
                );
              })}
            </div>

            {carView === "3d" ? (
              <VehicleModel3DLazy
                height={ALTO_VEHICULO}
                parts={parts}
                engineHeat={engineHeat}
                onPartClick={abrirPieza}
                fallback={
                  <VehicleModel
                    size={300}
                    orientation="left"
                    iconic
                    parts={parts}
                    engineHeat={engineHeat}
                    onPartClick={abrirPieza}
                  />
                }
              />
            ) : (
              <VehicleModel
                size={300}
                orientation="left"
                iconic
                parts={parts}
                engineHeat={engineHeat}
                onPartClick={abrirPieza}
              />
            )}
          </div>
        </div>

        {/* Cuentavueltas, con el consumo debajo */}
        <div className="flex shrink-0 flex-col items-center justify-center gap-1.5">
          <RpmGauge
            rpm={t?.rpm ?? 0}
            size={300}
            max={DEFAULT_PROFILE.maxRpm}
            redline={DEFAULT_PROFILE.redlineRpm}
          />
          <div className="encaje-suave flex items-center gap-3 rounded-xl px-4 py-1.5">
            <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 text-accent" {...trazo}>
              <path d="M5 20V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v15M3.5 20h11M13 10.5h3a2 2 0 0 1 2 2v3.5a1.5 1.5 0 0 0 3 0V9l-2.5-2.5" />
            </svg>
            <span className="flex flex-col leading-tight">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
                Consumo
              </span>
              <span className="flex items-baseline gap-1">
                <span className="text-lg font-bold tabular-nums text-silver">
                  {fmt(instantaneo.valor, 1)}
                </span>
                <span className="text-[10px] text-muted">{instantaneo.unidad}</span>
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Fila inferior: averías · testigos · viaje ─────────── */}
      {/* El coche no se repite aquí: el de arriba ya resalta la pieza
          averiada, y dibujarlo dos veces era enseñar lo mismo dos veces. */}
      <div className="grid h-[152px] shrink-0 grid-cols-[1.2fr_1.35fr_1.55fr] gap-6">
        <FaultPanel
          plain
          faults={faults}
          onSelect={() => router.push("/diagnostics")}
          onSeeAll={() => router.push("/diagnostics")}
        />

        {/* Los tres bloques arrancan con rótulo a la misma altura. Sin él,
            la fila se leía como una cosa etiquetada y dos flotando. */}
        <div className="flex flex-col px-1">
          <span className="mb-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
            Sistemas
          </span>
          <div className="flex items-start justify-around">
            <StatusLight kind="abs" status={t?.systems.abs ?? "unknown"} />
            <StatusLight kind="esp" status={t?.systems.esp ?? "unknown"} />
            <StatusLight kind="airbag" status={t?.systems.airbag ?? "unknown"} />
            <StatusLight kind="engine" status={t?.systems.engine ?? "unknown"} />
          </div>
        </div>

        <div className="flex flex-col px-1">
          <span className="mb-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
            Viaje actual
          </span>
          <div className="grid grid-cols-4 items-start">
            {[
              {
                l: "Distancia",
                v: fmt(viaje.distancia, 1),
                u: "km",
                i: (
                  <path d="M6.5 20.5V8.5a3 3 0 0 1 3-3h5a3 3 0 0 0 3-3M6.5 20.5l-2.2-2.6M6.5 20.5l2.2-2.6" />
                ),
              },
              {
                l: "Consumo medio",
                v: fmt(viaje.consumo, 1),
                u: "L/100km",
                i: (
                  <path d="M12 3.5c3.2 3.6 5.2 6.3 5.2 8.8a5.2 5.2 0 1 1-10.4 0c0-2.5 2-5.2 5.2-8.8z" />
                ),
              },
              {
                l: "Tiempo",
                v: tiempo,
                u: "h",
                i: (
                  <>
                    <circle cx="12" cy="12.5" r="8" />
                    <path d="M12 8v4.5l3 1.8" />
                  </>
                ),
              },
              {
                l: "Autonomía",
                v: fmt(viaje.autonomia, 0),
                u: "km",
                i: (
                  <path d="M5 20V5.5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1V20M3.5 20h11M13 10.5h3a2 2 0 0 1 2 2v3.5a1.5 1.5 0 0 0 3 0V9l-2.5-2.5M7 8.5h4" />
                ),
              },
            ].map((d, i) => (
              <div key={d.l} className="relative flex min-w-0 flex-col items-center px-1">
                {i > 0 ? (
                  <span aria-hidden="true" className="filete-suave absolute inset-y-1 left-0" />
                ) : null}
                <svg viewBox="0 0 24 24" className="h-7 w-7 text-accent" {...trazo}>
                  {d.i}
                </svg>
                <span className="mt-1 max-w-full truncate text-[10px] font-semibold uppercase tracking-[0.04em] text-accent">
                  {d.l}
                </span>
                <span className="flex items-baseline gap-1">
                  <span className="text-xl font-semibold leading-tight tabular-nums text-silver">
                    {d.v}
                  </span>
                  <span className="text-[10px] text-muted">{d.u}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
