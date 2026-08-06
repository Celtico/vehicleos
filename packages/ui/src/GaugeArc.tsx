/**
 * GaugeArc — arco de instrumentación genérico estilo MBUX.
 *
 * El progreso y el número central se animan con requestAnimationFrame
 * (ver `useAnimatedNumber`): React solo renderiza la carcasa estática;
 * cada frame muta los atributos SVG mediante refs.
 */
import { useId, useMemo, useRef } from "react";
import { clamp, useAnimatedNumber } from "./animation";
import { describeArc, polarToCartesian } from "./arc";
import { MBUX, zoneColor, type GaugeZone } from "./theme";

/** Ángulos del arco (0° = arriba): de -120° a +120° → barrido de 240°. */
const START = -120;
const END = 120;
const SWEEP = END - START;

export interface GaugeArcProps {
  /** Último valor recibido (objetivo de la animación). */
  value: number;
  min?: number;
  max?: number;
  /** Etiqueta inferior (p. ej. "VELOCIDAD"). */
  label?: string;
  /** Unidad mostrada bajo el número (p. ej. "km/h"). */
  unit?: string;
  /** Lado del SVG en píxeles. */
  size?: number;
  /** Color base del progreso. */
  color?: string;
  /** Zonas de color (p. ej. zona roja). */
  zones?: GaugeZone[];
  /** Distancia entre marcas graduadas (en unidades del valor). */
  tickStep?: number;
  /** Formatea la etiqueta de cada marca. */
  tickLabel?: (v: number) => string;
  /** Formatea el número central. */
  format?: (v: number) => string;
}

export function GaugeArc({
  value,
  min = 0,
  max = 100,
  label,
  unit,
  size = 280,
  color = MBUX.accent,
  zones,
  tickStep,
  tickLabel = (v) => String(Math.round(v)),
  format = (v) => String(Math.round(v)),
}: GaugeArcProps) {
  const uid = useId();
  const progressRef = useRef<SVGPathElement | null>(null);
  const glowRef = useRef<SVGPathElement | null>(null);
  const textRef = useRef<SVGTextElement | null>(null);

  const range = max - min || 1;

  // Frame de animación: muta d/stroke del arco y el texto central.
  useAnimatedNumber(value, (v) => {
    const frac = clamp((v - min) / range, 0, 1);
    const endAngle = START + Math.max(0.5, frac * SWEEP);
    const d = describeArc(100, 100, 84, START, endAngle);
    const stroke = zoneColor(v, zones, color);
    if (progressRef.current) {
      progressRef.current.setAttribute("d", d);
      progressRef.current.setAttribute("stroke", stroke);
      progressRef.current.setAttribute("opacity", frac < 0.004 ? "0" : "1");
    }
    if (glowRef.current) {
      glowRef.current.setAttribute("d", d);
      glowRef.current.setAttribute("stroke", stroke);
      glowRef.current.setAttribute("opacity", frac < 0.004 ? "0" : "0.28");
    }
    if (textRef.current) textRef.current.textContent = format(v);
  });

  // Marcas y zonas: estáticas, se calculan una sola vez.
  const ticks = useMemo(() => {
    if (!tickStep) return [];
    const out: { angle: number; label: string; major: boolean }[] = [];
    for (let v = min; v <= max + 1e-9; v += tickStep) {
      out.push({
        angle: START + ((v - min) / range) * SWEEP,
        label: tickLabel(v),
        major: true,
      });
    }
    return out;
  }, [min, max, range, tickStep, tickLabel]);

  const zonePaths = useMemo(
    () =>
      (zones ?? []).map((z) => ({
        d: describeArc(
          100,
          100,
          93,
          START + ((clamp(z.from, min, max) - min) / range) * SWEEP,
          START + ((clamp(z.to, min, max) - min) / range) * SWEEP,
        ),
        color: z.color,
      })),
    [zones, min, max, range],
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role="meter"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      style={{ display: "block", fontFamily: MBUX.font }}
    >
      <defs>
        <filter id={`${uid}-blur`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      {/* Pista de fondo */}
      <path
        d={describeArc(100, 100, 84, START, END)}
        fill="none"
        stroke={MBUX.track}
        strokeWidth={9}
        strokeLinecap="round"
      />

      {/* Zonas de color (fina, por fuera de la pista) */}
      {zonePaths.map((z, i) => (
        <path
          key={i}
          d={z.d}
          fill="none"
          stroke={z.color}
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.85}
        />
      ))}

      {/* Halo del progreso (glow ambiental) */}
      <path
        ref={glowRef}
        fill="none"
        stroke={color}
        strokeWidth={16}
        strokeLinecap="round"
        filter={`url(#${uid}-blur)`}
        opacity={0}
      />
      {/* Arco de progreso animado */}
      <path
        ref={progressRef}
        fill="none"
        stroke={color}
        strokeWidth={9}
        strokeLinecap="round"
        opacity={0}
      />

      {/* Marcas graduadas */}
      {ticks.map((t, i) => {
        const p1 = polarToCartesian(100, 100, 74, t.angle);
        const p2 = polarToCartesian(100, 100, 68, t.angle);
        const pt = polarToCartesian(100, 100, 58, t.angle);
        return (
          <g key={i}>
            <line
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={MBUX.muted}
              strokeWidth={1.2}
            />
            <text
              x={pt.x}
              y={pt.y}
              fill={MBUX.muted}
              fontSize={7.5}
              fontWeight={300}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {t.label}
            </text>
          </g>
        );
      })}

      {/* Número central animado */}
      <text
        ref={textRef}
        x={100}
        y={102}
        fill={MBUX.text}
        fontSize={42}
        fontWeight={200}
        letterSpacing={-1}
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {format(value)}
      </text>
      {unit ? (
        <text
          x={100}
          y={128}
          fill={MBUX.muted}
          fontSize={10}
          fontWeight={300}
          letterSpacing={1.5}
          textAnchor="middle"
        >
          {unit}
        </text>
      ) : null}
      {label ? (
        <text
          x={100}
          y={182}
          fill={MBUX.silver}
          fontSize={9}
          fontWeight={300}
          letterSpacing={3}
          textAnchor="middle"
        >
          {label.toUpperCase()}
        </text>
      ) : null}
    </svg>
  );
}
