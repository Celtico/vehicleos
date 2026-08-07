/**
 * MetricInline — magnitud compacta: icono, valor y barra de rango.
 *
 * Ocupa la mitad que una tarjeta y se lee igual de bien, que es lo que
 * permite poner cinco magnitudes en el hueco donde antes cabían cuatro
 * tarjetas dejando aire muerto alrededor.
 *
 * Anima por refs con requestAnimationFrame, sin re-render por fotograma.
 */
import { useRef } from "react";
import { clamp, useAnimatedNumber } from "./animation";
import { MBUX } from "./theme";

export interface MetricInlineProps {
  label: string;
  value: number;
  unit: string;
  min?: number;
  max: number;
  /** Valor a partir del cual la barra pasa a rojo. */
  danger?: number;
  decimals?: number;
  /** Icono SVG inline, sobre el número. */
  icon?: React.ReactNode;
}

export function MetricInline({
  label,
  value,
  unit,
  min = 0,
  max,
  danger,
  decimals = 0,
  icon,
}: MetricInlineProps) {
  const numeroRef = useRef<HTMLSpanElement>(null);
  const barraRef = useRef<HTMLSpanElement>(null);

  useAnimatedNumber(value, (v) => {
    if (numeroRef.current) numeroRef.current.textContent = v.toFixed(decimals);
    if (barraRef.current) {
      barraRef.current.style.width = `${clamp(((v - min) / (max - min)) * 100, 0, 100)}%`;
      barraRef.current.style.background =
        danger !== undefined && v >= danger ? MBUX.danger : MBUX.accent;
    }
  });

  return (
    <div className="flex min-w-0 flex-col items-center gap-1">
      {icon ? <span className="text-accent">{icon}</span> : null}

      <span className="flex items-baseline gap-1">
        <span
          ref={numeroRef}
          className="font-medium leading-none text-silver"
          style={{ fontSize: 26, fontVariantNumeric: "tabular-nums" }}
        >
          {value.toFixed(decimals)}
        </span>
        <span className="text-[11px] text-muted">{unit}</span>
      </span>

      <span className="max-w-full truncate text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">
        {label}
      </span>

      <span className="h-[3px] w-full overflow-hidden rounded-full bg-muted/25">
        <span
          ref={barraRef}
          className="block h-full rounded-full"
          style={{ width: 0, background: MBUX.accent }}
        />
      </span>
    </div>
  );
}
