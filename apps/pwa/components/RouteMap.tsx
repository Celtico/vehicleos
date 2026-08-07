"use client";

/**
 * Mapa de calles real para la página de ruta: MapLibre GL con teselas raster
 * de OpenStreetMap servidas por CARTO (variante oscura o clara según el tema
 * del cockpit). Sin clave de API; requiere conexión a internet — la página
 * cae a la vista SVG offline cuando no la hay.
 *
 * La ruta NO va como capa GeoJSON de MapLibre: esas capas se procesan en un
 * web worker que con el bundler de Next se queda mudo (la fuente nunca
 * termina de cargar, sin error). En su lugar, MapLibre solo pinta las
 * teselas y la ruta se dibuja en un SVG superpuesto, proyectando cada punto
 * con `map.project()` y redibujando en cada movimiento de cámara. Para unos
 * cientos de puntos a 1 Hz es más que suficiente.
 */
import { useEffect, useReducer, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export interface RouteMapProps {
  /** Ruta acumulada del viaje (orden cronológico). */
  path: { lat: number; lon: number }[];
  /** Posición actual del vehículo. */
  location?: { lat: number; lon: number; heading?: number } | null;
}

const COLOR_RUTA = "#4d94ff";

/** ¿El cockpit está en tema nocturno? (el diurno marca data-tema="dia"). */
function esTemaOscuro(): boolean {
  return document.documentElement.getAttribute("data-tema") !== "dia";
}

/** Estilo base: una sola capa raster de OSM/CARTO. */
function estiloBase(oscuro: boolean): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      base: {
        type: "raster",
        tiles: [
          `https://basemaps.cartocdn.com/${oscuro ? "dark_all" : "light_all"}/{z}/{x}/{y}@2x.png`,
        ],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors · © CARTO",
      },
    },
    layers: [{ id: "base", type: "raster", source: "base" }],
  };
}

export function RouteMap({ path, location }: RouteMapProps) {
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const mapaRef = useRef<maplibregl.Map | null>(null);
  const encuadradoRef = useRef(false);
  const locationRef = useRef(location);
  locationRef.current = location;

  // El SVG superpuesto se recalcula en cada movimiento de cámara.
  const [, redibujar] = useReducer((x: number) => x + 1, 0);

  /* --- Montaje: mapa y observador de tema ------------------------------- */
  useEffect(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor) return;

    const centroInicial: [number, number] = locationRef.current
      ? [locationRef.current.lon, locationRef.current.lat]
      : [-3.7038, 40.4168]; // Madrid, hasta que llegue el GPS

    const mapa = new maplibregl.Map({
      container: contenedor,
      style: estiloBase(esTemaOscuro()),
      center: centroInicial,
      zoom: 15,
      attributionControl: { compact: true },
    });
    mapaRef.current = mapa;

    mapa.on("move", redibujar);
    mapa.on("load", redibujar);

    // Cambio de tema del cockpit → teselas oscuras o claras.
    const observadorTema = new MutationObserver(() => {
      mapa.setStyle(estiloBase(esTemaOscuro()));
    });
    observadorTema.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-tema"],
    });

    return () => {
      observadorTema.disconnect();
      mapaRef.current = null;
      mapa.remove();
    };
  }, []);

  /* --- Seguimiento de la posición --------------------------------------- */
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !location) return;
    if (!encuadradoRef.current) {
      // Primer GPS: salto directo, sin animar desde el centro por defecto.
      mapa.jumpTo({ center: [location.lon, location.lat], zoom: 15 });
      encuadradoRef.current = true;
    } else {
      mapa.easeTo({ center: [location.lon, location.lat], duration: 900 });
    }
  }, [location]);

  /* --- Proyección de la ruta al lienzo actual --------------------------- */
  const mapa = mapaRef.current;
  const puntos =
    mapa && path.length > 1
      ? path.map((p) => {
          const q = mapa.project([p.lon, p.lat]);
          return `${q.x.toFixed(1)},${q.y.toFixed(1)}`;
        })
      : null;
  const actual = mapa && location ? mapa.project([location.lon, location.lat]) : null;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg">
      <div ref={contenedorRef} className="h-full w-full" />
      {/* Ruta y posición actual, por encima de las teselas */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        {puntos ? (
          <polyline
            points={puntos.join(" ")}
            fill="none"
            stroke={COLOR_RUTA}
            strokeWidth={4}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={0.9}
          />
        ) : null}
        {actual ? (
          <g
            transform={`translate(${actual.x}, ${actual.y}) rotate(${location?.heading ?? 0})`}
          >
            <circle r={14} fill={COLOR_RUTA} opacity={0.22}>
              <animate attributeName="r" values="11;17;11" dur="2s" repeatCount="indefinite" />
            </circle>
            <path
              d="M0 -10 L7 8 L0 4 L-7 8 Z"
              fill={COLOR_RUTA}
              stroke="#ffffff"
              strokeWidth={1.5}
            />
          </g>
        ) : null}
      </svg>
    </div>
  );
}
