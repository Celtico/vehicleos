/**
 * LinearGauge — barra horizontal para combustible, temperatura, tensión o turbo.
 * La barra y el número se animan con rAF mutando atributos SVG (sin re-render).
 */
import { useRef } from "react";
import { clamp, useAnimatedNumber } from "./animation";
import { MBUX, zoneColor, type GaugeZone } from "./theme";

export interface LinearGaugeProps {
  /** Último valor recibido. */
  value: number;
  min?: number;
  max?: number;
  /** Etiqueta (p. ej. "Refrigerante"). */
  label: string;
  /** Unidad (p. ej. "°C"). */
  unit?: string;
  /** Color base de la barra. */
  color?: string;
  /** Zonas de color (aviso/peligro). */
  zones?: GaugeZone[];
  /** Formatea el número mostrado. */
  format?: (v: number) => string;
}

export function LinearGauge({
  value,
  min = 0,
  max = 100,
  label,
  unit,
  color = MBUX.accent,
  zones,
  format = (v) => String(Math.round(v)),
}: LinearGaugeProps) {
  const fillRef = useRef<SVGRectElement | null>(null);
  const valueRef = useRef<HTMLSpanElement | null>(null);
  const range = max - min || 1;

  useAnimatedNumber(value, (v) => {
    const frac = clamp((v - min) / range, 0, 1);
    const stroke = zoneColor(v, zones, color);
    if (fillRef.current) {
      fillRef.current.setAttribute("width", String(frac * 100));
      fillRef.current.setAttribute("fill", stroke);
    }
    if (valueRef.current) valueRef.current.textContent = format(v);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, fontFamily: MBUX.font }}>
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
        <span style={{ color: MBUX.text, fontWeight: 200, fontSize: 20 }}>
          <span ref={valueRef}>{format(value)}</span>
          {unit ? (
            <span style={{ color: MBUX.muted, fontSize: 11, marginLeft: 4 }}>{unit}</span>
          ) : null}
        </span>
      </div>
      <svg
        width="100%"
        height={8}
        viewBox="0 0 100 8"
        preserveAspectRatio="none"
        role="meter"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        style={{ display: "block" }}
      >
        {/* Pista */}
        <rect x={0} y={2.5} width={100} height={3} rx={1.5} fill={MBUX.track} />
        {/* Zonas de referencia */}
        {(zones ?? []).map((z, i) => {
          const x = ((clamp(z.from, min, max) - min) / range) * 100;
          const w = ((clamp(z.to, min, max) - clamp(z.from, min, max)) / range) * 100;
          return (
            <rect key={i} x={x} y={6.5} width={w} height={1.2} fill={z.color} opacity={0.7} />
          );
        })}
        {/* Relleno animado */}
        <rect ref={fillRef} x={0} y={2.5} width={0} height={3} rx={1.5} fill={color} />
      </svg>
    </div>
  );
}
