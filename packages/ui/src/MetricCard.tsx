/**
 * MetricCard — tarjeta compacta de magnitud con barra de rango.
 *
 * Pensada para la fila superior de una pantalla de coche: número grande
 * legible de un vistazo, unidad discreta y una barra que sitúa el valor
 * dentro de su rango, con zona de peligro cuando la tiene.
 *
 * Como el resto de la instrumentación, anima con requestAnimationFrame
 * mutando atributos por refs: sin re-render por fotograma.
 */
import { useRef } from "react";
import { clamp, useAnimatedNumber } from "./animation";
import { MBUX } from "./theme";

export interface MetricCardProps {
  /** Etiqueta en mayúsculas, p. ej. "VELOCIDAD". */
  label: string;
  value: number;
  unit: string;
  min?: number;
  max: number;
  /** Valor a partir del cual la barra pasa a rojo. */
  danger?: number;
  /** Decimales del número grande. */
  decimals?: number;
  /** Icono opcional a la derecha de la etiqueta. */
  icon?: React.ReactNode;
}

export function MetricCard({
  label,
  value,
  unit,
  min = 0,
  max,
  danger,
  decimals = 0,
  icon,
}: MetricCardProps) {
  const numeroRef = useRef<HTMLSpanElement>(null);
  const barraRef = useRef<HTMLSpanElement>(null);

  useAnimatedNumber(value, (v) => {
    if (numeroRef.current) numeroRef.current.textContent = v.toFixed(decimals);
    if (barraRef.current) {
      const pct = clamp(((v - min) / (max - min)) * 100, 0, 100);
      barraRef.current.style.width = `${pct}%`;
      barraRef.current.style.background =
        danger !== undefined && v >= danger ? MBUX.danger : MBUX.accent;
    }
  });

  // Posición donde empieza la zona roja, para pintarla en el carril.
  const inicioPeligro =
    danger !== undefined ? clamp(((danger - min) / (max - min)) * 100, 0, 100) : null;

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.22em] text-accent">{label}</span>
        {icon ? <span className="text-muted">{icon}</span> : null}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span
          ref={numeroRef}
          className="font-light leading-none text-silver"
          style={{ fontSize: 40, fontVariantNumeric: "tabular-nums" }}
        >
          {value.toFixed(decimals)}
        </span>
        <span className="text-xs text-muted">{unit}</span>
      </div>

      <div>
        <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/10">
          {inicioPeligro !== null ? (
            <span
              className="absolute inset-y-0 rounded-r-full"
              style={{
                left: `${inicioPeligro}%`,
                right: 0,
                background: MBUX.danger,
                opacity: 0.25,
              }}
            />
          ) : null}
          <span
            ref={barraRef}
            className="absolute inset-y-0 left-0 rounded-full transition-colors"
            style={{ width: 0, background: MBUX.accent }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[9px] tabular-nums text-muted">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
    </div>
  );
}
