"use client";

/**
 * Mapa propio SIN servicios externos: SVG que dibuja la ruta GPS acumulada
 * del stream en vivo como polyline autoescalada, con el punto actual y su
 * rumbo. Nada de teselas ni claves de API.
 */
import { useMemo } from "react";
import { alfa, Card, MBUX } from "@vehicleos/ui";
import { useVehicleStore } from "../../store/vehicle-store";

const W = 900;
const H = 520;
const PAD = 40;

export default function MapPage() {
  const path = useVehicleStore((s) => s.path);
  const telemetry = useVehicleStore((s) => s.telemetry);
  const clearPath = useVehicleStore((s) => s.clearPath);
  const location = telemetry?.location;

  // Proyección equirectangular local autoescalada a la caja del SVG.
  const projected = useMemo(() => {
    if (path.length < 2) return null;
    let minLat = Infinity,
      maxLat = -Infinity,
      minLon = Infinity,
      maxLon = -Infinity;
    for (const p of path) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lon < minLon) minLon = p.lon;
      if (p.lon > maxLon) maxLon = p.lon;
    }
    // Corrige la compresión longitudinal según la latitud media.
    const midLat = (minLat + maxLat) / 2;
    const lonScale = Math.cos((midLat * Math.PI) / 180);
    const spanLat = Math.max(maxLat - minLat, 1e-5);
    const spanLon = Math.max((maxLon - minLon) * lonScale, 1e-5);
    const scale = Math.min((W - 2 * PAD) / spanLon, (H - 2 * PAD) / spanLat);

    const toXY = (lat: number, lon: number): [number, number] => {
      const x = PAD + ((lon - minLon) * lonScale * scale + (W - 2 * PAD - spanLon * scale) / 2);
      const y = PAD + ((maxLat - lat) * scale + (H - 2 * PAD - spanLat * scale) / 2);
      return [x, y];
    };

    const points = path.map((p) => toXY(p.lat, p.lon));
    const current = location ? toXY(location.lat, location.lon) : points[points.length - 1];
    return { points, current };
  }, [path, location]);

  return (
    <div className="flex h-full flex-col gap-3 px-4 pb-2 pt-1">
      <div className="flex shrink-0 items-center justify-between">
        <h1 className="text-xl font-medium tracking-[0.2em] text-silver">
          MAPA · RUTA EN VIVO
        </h1>
        <button
          onClick={clearPath}
          className="rounded-lg border border-linea/15 px-4 py-2 text-xs uppercase tracking-widest text-muted transition-colors hover:border-accent/40 hover:text-accent"
        >
          Limpiar ruta
        </button>
      </div>

      <Card style={{ padding: 8, flex: 1, minHeight: 0, display: "flex" }}>
        {projected ? (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-full w-full"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Rejilla de referencia */}
            {Array.from({ length: 9 }, (_, i) => (
              <line
                key={`v${i}`}
                x1={(W / 9) * (i + 0.5)}
                y1={0}
                x2={(W / 9) * (i + 0.5)}
                y2={H}
                stroke="rgba(148,178,184,0.06)"
              />
            ))}
            {Array.from({ length: 6 }, (_, i) => (
              <line
                key={`h${i}`}
                x1={0}
                y1={(H / 6) * (i + 0.5)}
                x2={W}
                y2={(H / 6) * (i + 0.5)}
                stroke="rgba(148,178,184,0.06)"
              />
            ))}

            {/* Ruta acumulada */}
            <polyline
              points={projected.points
                .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
                .join(" ")}
              fill="none"
              stroke="#00d2be"
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={0.9}
            />

            {/* Punto de inicio */}
            {projected.points[0] ? (
              <circle
                cx={projected.points[0][0]}
                cy={projected.points[0][1]}
                r={5}
                fill="none"
                stroke="#7f9299"
                strokeWidth={1.5}
              />
            ) : null}

            {/* Posición actual con rumbo */}
            {projected.current ? (
              <g
                transform={`translate(${projected.current[0]}, ${projected.current[1]}) rotate(${location?.heading ?? 0})`}
              >
                <circle r={12} fill={alfa("accent", 0.15)}>
                  <animate
                    attributeName="r"
                    values="10;16;10"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                </circle>
                <path
                  d="M0 -9 L6 7 L0 3.5 L-6 7 Z"
                  fill={MBUX.accent}
                  stroke="rgb(var(--c-bg))"
                  strokeWidth={1}
                />
              </g>
            ) : null}
          </svg>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2">
            <p className="text-lg font-medium text-silver">Esperando señal GPS…</p>
            <p className="text-sm text-muted">
              La ruta se dibujará según el vehículo se mueva (prueba el escenario Ciudad o
              Autopista en Ajustes).
            </p>
          </div>
        )}
      </Card>

      {/* Lecturas de posición */}
      <div className="grid shrink-0 grid-cols-4 gap-3">
        <Readout label="Latitud" value={location ? location.lat.toFixed(5) : "—"} />
        <Readout label="Longitud" value={location ? location.lon.toFixed(5) : "—"} />
        <Readout
          label="Rumbo"
          value={location?.heading !== undefined ? `${Math.round(location.heading)}°` : "—"}
        />
        <Readout label="Puntos de ruta" value={String(path.length)} />
      </div>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel-cockpit rounded-xl px-4 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-lg font-medium text-silver">{value}</p>
    </div>
  );
}
