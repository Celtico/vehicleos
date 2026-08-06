/**
 * BatteryIndicator — tensión de batería/sistema de carga con icono y color
 * según el estado (carga correcta, descarga, tensión baja).
 */
import { useRef } from "react";
import { useAnimatedNumber } from "./animation";
import { MBUX } from "./theme";

export interface BatteryIndicatorProps {
  /** Tensión en voltios. */
  voltage: number;
  /** Con el motor en marcha el umbral de "carga correcta" sube. */
  engineRunning?: boolean;
}

function batteryColor(v: number, running: boolean): string {
  if (running) {
    if (v >= 13.2 && v <= 14.9) return MBUX.ok;
    if (v >= 12.2) return MBUX.warning;
    return MBUX.danger;
  }
  if (v >= 12.4) return MBUX.ok;
  if (v >= 11.8) return MBUX.warning;
  return MBUX.danger;
}

function batteryStatus(v: number, running: boolean): string {
  if (running) {
    if (v >= 13.2 && v <= 14.9) return "Cargando";
    if (v >= 12.2) return "Carga débil";
    return "No carga";
  }
  if (v >= 12.4) return "Reposo OK";
  if (v >= 11.8) return "Algo baja";
  return "Descargada";
}

export function BatteryIndicator({ voltage, engineRunning = false }: BatteryIndicatorProps) {
  const textRef = useRef<HTMLSpanElement | null>(null);
  const iconRef = useRef<SVGGElement | null>(null);
  const statusRef = useRef<HTMLSpanElement | null>(null);

  useAnimatedNumber(voltage, (v) => {
    const color = batteryColor(v, engineRunning);
    if (textRef.current) {
      textRef.current.textContent = v.toFixed(1);
      textRef.current.style.color = color;
    }
    if (iconRef.current) iconRef.current.setAttribute("stroke", color);
    if (statusRef.current) statusRef.current.textContent = batteryStatus(v, engineRunning);
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontFamily: MBUX.font,
      }}
      title="Tensión de batería"
    >
      <svg width={40} height={40} viewBox="0 0 32 32" role="img" aria-label="Batería">
        <g
          ref={iconRef}
          stroke={batteryColor(voltage, engineRunning)}
          fill="none"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Carcasa con bornes */}
          <rect x="4" y="11" width="24" height="14" rx="2" />
          <line x1="8.5" y1="8.5" x2="12.5" y2="8.5" />
          <line x1="19.5" y1="8.5" x2="23.5" y2="8.5" />
          {/* Polos − y + */}
          <line x1="8.5" y1="18" x2="12.5" y2="18" />
          <line x1="19.5" y1="18" x2="23.5" y2="18" />
          <line x1="21.5" y1="16" x2="21.5" y2="20" />
        </g>
      </svg>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize: 24, fontWeight: 200, color: MBUX.text }}>
          <span ref={textRef}>{voltage.toFixed(1)}</span>
          <span style={{ fontSize: 12, color: MBUX.muted, marginLeft: 4 }}>V</span>
        </span>
        <span
          ref={statusRef}
          style={{
            fontSize: 10,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: MBUX.muted,
          }}
        >
          {batteryStatus(voltage, engineRunning)}
        </span>
      </div>
    </div>
  );
}
