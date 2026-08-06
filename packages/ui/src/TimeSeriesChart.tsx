/**
 * TimeSeriesChart — gráfica de líneas en SVG puro (sin librerías externas)
 * para series de telemetría en tiempo real.
 *
 * Diseñada para mirarse de reojo mientras se conduce: sin tooltips ni
 * interactividad, con el último valor destacado en grande. La curva se
 * suaviza con Catmull-Rom convertido a béziers cúbicas y se rellena con un
 * degradado. El número grande se anima con rAF mutando el DOM por refs
 * (sin re-render por frame), igual que el resto de la instrumentación.
 *
 * Rendimiento: las series de más de `MAX_PUNTOS` muestras se submuestrean
 * conservando los picos, de modo que el coste de dibujado es constante
 * aunque lleguen miles de puntos.
 */
import { useId, useMemo, useRef } from "react";
import { useAnimatedNumber } from "./animation";
import { MBUX } from "./theme";

/** Muestra de una serie temporal: instante (ms) y valor. */
export interface SeriesPoint {
  /** Marca de tiempo en ms (orden cronológico ascendente). */
  t: number;
  /** Valor medido. */
  v: number;
}

export interface TimeSeriesChartProps {
  /** Muestras en orden cronológico. */
  points: SeriesPoint[];
  /** Mínimo del eje Y; si se omite, autoescala con margen. */
  min?: number;
  /** Máximo del eje Y; si se omite, autoescala con margen. */
  max?: number;
  /** Etiqueta de la serie (p. ej. "Refrigerante"). */
  label: string;
  /** Unidad mostrada junto al valor (p. ej. "°C"). */
  unit: string;
  /** Color de la curva; por defecto el acento MBUX. */
  color?: string;
  /** Zonas de fondo coloreadas, p.ej. temperatura >105 en rojo. */
  zones?: { from: number; to: number; color: string }[];
  /** Alto del área de dibujo en px (sin contar la cabecera). */
  height?: number;
  /** Formato del valor actual mostrado en grande. */
  format?: (v: number) => string;
}

/** Ancho lógico del viewBox; el SVG se estira al 100% del contenedor. */
const ANCHO = 1000;
/** Máximo de muestras dibujadas tras el submuestreo. */
const MAX_PUNTOS = 400;
/** Margen vertical interno para que la curva no toque los bordes. */
const PAD_Y = 6;

/** Punto ya proyectado a coordenadas del viewBox. */
interface Pt {
  x: number;
  y: number;
}

/**
 * Reduce la serie a `maxPuntos` conservando los extremos: dentro de cada
 * cubo se queda la muestra que más se aleja de la última conservada, de modo
 * que los picos y valles no desaparecen al comprimir. La última muestra
 * siempre se mantiene (es el valor actual).
 */
export function submuestrear(points: SeriesPoint[], maxPuntos = MAX_PUNTOS): SeriesPoint[] {
  const n = points.length;
  if (n <= maxPuntos || maxPuntos < 2) return points;

  const primero = points[0];
  const ultimo = points[n - 1];
  if (!primero || !ultimo) return points;

  const salida: SeriesPoint[] = [primero];
  let anterior = primero;
  // Se reparten los cubos entre la primera y la última muestra (ya fijas).
  const cubos = maxPuntos - 2;
  const paso = (n - 2) / cubos;

  for (let i = 0; i < cubos; i++) {
    const desde = 1 + Math.floor(i * paso);
    const hasta = Math.min(n - 1, 1 + Math.floor((i + 1) * paso));
    let mejor: SeriesPoint | undefined;
    let mejorDelta = -1;
    for (let j = desde; j < hasta; j++) {
      const p = points[j];
      if (!p) continue;
      const delta = Math.abs(p.v - anterior.v);
      if (delta > mejorDelta) {
        mejorDelta = delta;
        mejor = p;
      }
    }
    if (mejor) {
      salida.push(mejor);
      anterior = mejor;
    }
  }

  salida.push(ultimo);
  return salida;
}

/** Devuelve el punto `i` acotando el índice (evita huecos en los extremos). */
function puntoEn(pts: Pt[], i: number): Pt {
  const j = Math.min(pts.length - 1, Math.max(0, i));
  return pts[j] ?? { x: 0, y: 0 };
}

/**
 * Construye una curva suave (Catmull-Rom → bézier cúbica). Los puntos de
 * control se acotan al área de dibujo para que la suavización no se salga
 * del rango al pasar por picos pronunciados.
 */
function curvaSuave(pts: Pt[], yTop: number, yBottom: number): string {
  if (pts.length === 0) return "";
  const p0 = puntoEn(pts, 0);
  if (pts.length === 1) return `M ${p0.x} ${p0.y}`;

  const acotar = (y: number) => Math.min(yBottom, Math.max(yTop, y));
  let d = `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)}`;

  for (let i = 0; i < pts.length - 1; i++) {
    const a = puntoEn(pts, i - 1);
    const b = puntoEn(pts, i);
    const c = puntoEn(pts, i + 1);
    const e = puntoEn(pts, i + 2);
    // Tangentes de Catmull-Rom (tensión estándar 1/6).
    const c1x = b.x + (c.x - a.x) / 6;
    const c1y = acotar(b.y + (c.y - a.y) / 6);
    const c2x = c.x - (e.x - b.x) / 6;
    const c2y = acotar(c.y - (e.y - b.y) / 6);
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`;
  }
  return d;
}

export function TimeSeriesChart({
  points,
  min,
  max,
  label,
  unit,
  color = MBUX.accent,
  zones,
  height = 140,
  format = (v) => String(Math.round(v)),
}: TimeSeriesChartProps) {
  const valueRef = useRef<HTMLSpanElement | null>(null);
  // useId puede incluir ":" — se limpia para usarlo en url(#...).
  const gradId = `tsc-${useId().replace(/:/g, "")}`;

  const geo = useMemo(() => {
    const muestras = submuestrear(points);
    const n = muestras.length;

    // Dominio vertical: fijo si se indica, autoescalado con margen si no.
    let yMin = min;
    let yMax = max;
    if (yMin === undefined || yMax === undefined) {
      let lo = Infinity;
      let hi = -Infinity;
      for (const p of muestras) {
        if (p.v < lo) lo = p.v;
        if (p.v > hi) hi = p.v;
      }
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
        lo = 0;
        hi = 1;
      }
      if (hi - lo < 1e-9) {
        // Serie plana (o un solo punto): se abre un rango legible alrededor.
        const margen = Math.max(1, Math.abs(hi) * 0.05);
        lo -= margen;
        hi += margen;
      } else {
        const margen = (hi - lo) * 0.08;
        lo -= margen;
        hi += margen;
      }
      if (yMin === undefined) yMin = lo;
      if (yMax === undefined) yMax = hi;
    }
    const rango = yMax - yMin || 1;

    const yTop = PAD_Y;
    const yBottom = height - PAD_Y;
    const alto = yBottom - yTop;
    const aY = (v: number) => yBottom - ((v - yMin!) / rango) * alto;

    // Eje X por tiempo real; si todas las marcas coinciden, por índice.
    const t0 = muestras[0]?.t ?? 0;
    const t1 = muestras[n - 1]?.t ?? 0;
    const span = t1 - t0;
    const aX = (p: SeriesPoint, i: number) =>
      span > 0 ? ((p.t - t0) / span) * ANCHO : n > 1 ? (i / (n - 1)) * ANCHO : ANCHO;

    const pts: Pt[] = muestras.map((p, i) => ({ x: aX(p, i), y: aY(p.v) }));

    let linea = "";
    let area = "";
    if (pts.length === 1) {
      // Un único punto: se dibuja una línea horizontal a su valor.
      const y = puntoEn(pts, 0).y.toFixed(2);
      linea = `M 0 ${y} L ${ANCHO} ${y}`;
      area = `${linea} L ${ANCHO} ${yBottom} L 0 ${yBottom} Z`;
    } else if (pts.length > 1) {
      linea = curvaSuave(pts, yTop, yBottom);
      area = `${linea} L ${ANCHO} ${yBottom} L 0 ${yBottom} Z`;
    }

    const ultimo = muestras[n - 1];
    return {
      linea,
      area,
      yMin: yMin!,
      yMax: yMax!,
      yTop,
      yBottom,
      aY,
      valorActual: ultimo?.v,
      yUltimo: ultimo ? aY(ultimo.v) : yBottom,
    };
  }, [points, min, max, height]);

  // El número grande se interpola por rAF sin re-renderizar el componente.
  useAnimatedNumber(geo.valorActual ?? 0, (v) => {
    if (valueRef.current) {
      valueRef.current.textContent = geo.valorActual === undefined ? "—" : format(v);
    }
  });

  const vacio = points.length === 0;
  const ejeTexto = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontFamily: MBUX.font }}>
      {/* Cabecera: etiqueta y valor actual destacado */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span
          style={{
            fontSize: 11,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: MBUX.muted,
            fontWeight: 300,
          }}
        >
          {label}
        </span>
        <span style={{ color: MBUX.text, fontWeight: 200, fontSize: 30, lineHeight: 1 }}>
          <span ref={valueRef}>
            {geo.valorActual === undefined ? "—" : format(geo.valorActual)}
          </span>
          <span style={{ color: MBUX.muted, fontSize: 12, marginLeft: 5, fontWeight: 300 }}>
            {unit}
          </span>
        </span>
      </div>

      {/* Área de dibujo: el margen derecho deja sitio al halo del punto final */}
      <div style={{ position: "relative", marginRight: 6 }}>
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${ANCHO} ${height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${label}: ${geo.valorActual === undefined ? "sin datos" : `${format(geo.valorActual)} ${unit}`}`}
          style={{ display: "block", overflow: "visible" }}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.32} />
              <stop offset="55%" stopColor={color} stopOpacity={0.09} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* Zonas de fondo (aviso/peligro) acotadas al dominio visible */}
          {(zones ?? []).map((z, i) => {
            const desde = Math.max(geo.yMin, Math.min(z.from, z.to));
            const hasta = Math.min(geo.yMax, Math.max(z.from, z.to));
            if (hasta <= desde) return null;
            const yArriba = geo.aY(hasta);
            const yAbajo = geo.aY(desde);
            return (
              <rect
                key={i}
                x={0}
                y={yArriba}
                width={ANCHO}
                height={Math.max(0, yAbajo - yArriba)}
                fill={z.color}
                opacity={0.12}
              />
            );
          })}

          {/* Rejilla discreta: 3 líneas interiores + bordes superior e inferior */}
          <g stroke={MBUX.track} strokeWidth={1} vectorEffect="non-scaling-stroke">
            {[0, 0.25, 0.5, 0.75, 1].map((f) => {
              const y = geo.yTop + f * (geo.yBottom - geo.yTop);
              return (
                <line
                  key={f}
                  x1={0}
                  y1={y}
                  x2={ANCHO}
                  y2={y}
                  opacity={f === 0 || f === 1 ? 0.9 : 0.45}
                />
              );
            })}
            {[0.25, 0.5, 0.75].map((f) => (
              <line
                key={`v${f}`}
                x1={f * ANCHO}
                y1={geo.yTop}
                x2={f * ANCHO}
                y2={geo.yBottom}
                opacity={0.28}
              />
            ))}
          </g>

          {!vacio ? (
            <>
              {/* Relleno degradado bajo la curva */}
              <path d={geo.area} fill={`url(#${gradId})`} stroke="none" />
              {/* Curva suavizada (grosor constante pese al escalado no uniforme) */}
              <path
                d={geo.linea}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </>
          ) : null}
        </svg>

        {/* Punto final con halo (HTML para que no lo deforme el viewBox) */}
        {!vacio ? (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "100%",
              top: geo.yUltimo,
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: color,
              boxShadow: `0 0 0 3px ${color}33, 0 0 14px ${color}`,
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
            }}
          />
        ) : null}

        {/* Etiquetas de eje: máximo arriba, mínimo abajo */}
        <span style={etiquetaEje(2)}>{ejeTexto(geo.yMax)}</span>
        <span style={etiquetaEje(undefined, 2)}>{ejeTexto(geo.yMin)}</span>

        {vacio ? (
          <span
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: MBUX.muted,
            }}
          >
            Sin datos
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Estilo común de las etiquetas de eje (arriba/abajo, a la izquierda). */
function etiquetaEje(top?: number, bottom?: number) {
  return {
    position: "absolute" as const,
    left: 4,
    top,
    bottom,
    fontSize: 9,
    letterSpacing: 1,
    color: MBUX.muted,
    fontWeight: 300,
    pointerEvents: "none" as const,
  };
}
