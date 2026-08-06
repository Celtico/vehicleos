/**
 * TelemetryTile — tarjeta métrica compacta (consumo, carga, odómetro…).
 * El número se anima con rAF sin re-render.
 */
import { useRef, type ReactNode } from "react";
import { useAnimatedNumber } from "./animation";
import { MBUX } from "./theme";

export interface TelemetryTileProps {
  label: string;
  /** Último valor recibido. */
  value: number;
  unit?: string;
  /** Decimales mostrados. */
  decimals?: number;
  /** Color del número (por defecto blanco). */
  accent?: string;
  /** Icono opcional a la izquierda. */
  icon?: ReactNode;
}

export function TelemetryTile({
  label,
  value,
  unit,
  decimals = 0,
  accent = MBUX.text,
  icon,
}: TelemetryTileProps) {
  const valueRef = useRef<HTMLSpanElement | null>(null);

  useAnimatedNumber(value, (v) => {
    if (valueRef.current) valueRef.current.textContent = v.toFixed(decimals);
  });

  return (
    <div
      style={{
        background: MBUX.panel,
        border: MBUX.border,
        borderRadius: 12,
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontFamily: MBUX.font,
        minWidth: 0,
      }}
    >
      {icon}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span
          style={{
            fontSize: 10,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: MBUX.muted,
            fontWeight: 300,
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
        <span style={{ fontSize: 24, fontWeight: 200, color: accent, whiteSpace: "nowrap" }}>
          <span ref={valueRef}>{value.toFixed(decimals)}</span>
          {unit ? (
            <span style={{ fontSize: 11, color: MBUX.muted, marginLeft: 4 }}>{unit}</span>
          ) : null}
        </span>
      </div>
    </div>
  );
}
