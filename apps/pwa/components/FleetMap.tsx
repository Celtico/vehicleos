"use client";

/**
 * Mapa de la flota.
 *
 * Dibuja la última posición conocida de cada vehículo sobre una rejilla
 * autoescalada. Como en /map, no usa servicios externos ni claves de API:
 * proyección equirectangular local con corrección por latitud.
 */
import { useMemo } from "react";
import type { GeoPoint } from "@vehicleos/shared";

export interface FleetMapPoint {
  vehicleId: string;
  name: string;
  location: GeoPoint;
  /** Colorea el marcador según la gravedad del estado del coche. */
  severity: "ok" | "warning" | "critical";
  selected?: boolean;
}

export interface FleetMapProps {
  points: FleetMapPoint[];
  height?: number;
  onSelect?: (vehicleId: string) => void;
}

const COLOR = {
  ok: "#4d94ff",
  warning: "#f5a524",
  critical: "#ff4d5e",
} as const;

export function FleetMap({ points, height = 340, onSelect }: FleetMapProps) {
  const proyectados = useMemo(() => {
    if (points.length === 0) return [];

    const lats = points.map((p) => p.location.lat);
    const lons = points.map((p) => p.location.lon);
    const latMin = Math.min(...lats);
    const latMax = Math.max(...lats);
    const lonMin = Math.min(...lons);
    const lonMax = Math.max(...lons);

    // Centro de la vista.
    const latCentro = (latMin + latMax) / 2;
    const lonCentro = (lonMin + lonMax) / 2;

    // Corrección por latitud: un grado de longitud mide menos según subes.
    const cosLat = Math.cos(latCentro * (Math.PI / 180));

    // Escala común a los dos ejes para no deformar el mapa: manda la
    // dimensión mayor. El mínimo evita dividir por cero con un solo coche.
    const escala = Math.max((lonMax - lonMin) * cosLat, latMax - latMin, 1e-4);

    // Los puntos ocupan el 70 % central; el resto es margen.
    return points.map((p) => ({
      ...p,
      x: 50 + (((p.location.lon - lonCentro) * cosLat) / escala) * 70,
      y: 50 - ((p.location.lat - latCentro) / escala) * 70,
    }));
  }, [points]);

  if (points.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border border-linea/10 bg-linea/[0.02] text-sm text-muted"
        style={{ height }}
      >
        Ningún vehículo ha reportado posición todavía.
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-linea/10 bg-linea/[0.02]"
      style={{ height }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        {/* Rejilla de referencia */}
        {[20, 40, 60, 80].map((v) => (
          <g key={v} stroke="rgba(255,255,255,0.05)" strokeWidth="0.15">
            <line x1={v} y1="0" x2={v} y2="100" />
            <line x1="0" y1={v} x2="100" y2={v} />
          </g>
        ))}
      </svg>

      {proyectados.map((p) => (
        <button
          key={p.vehicleId}
          onClick={() => onSelect?.(p.vehicleId)}
          className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-110"
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
          aria-label={`${p.name}, estado ${p.severity}`}
        >
          <span
            className="block h-3.5 w-3.5 rounded-full ring-2 ring-black/60"
            style={{
              background: COLOR[p.severity],
              boxShadow: `0 0 14px ${COLOR[p.severity]}`,
              outline: p.selected ? `2px solid ${COLOR[p.severity]}` : undefined,
              outlineOffset: 3,
            }}
          />
          <span className="mt-1 block whitespace-nowrap text-[10px] uppercase tracking-wider text-silver">
            {p.name}
          </span>
        </button>
      ))}
    </div>
  );
}
