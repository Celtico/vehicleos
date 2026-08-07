/**
 * MetricInline — magnitud compacta: arco, icono, valor y etiqueta.
 *
 * El arco va arriba rodeando el icono, y no una barra recta debajo: en una
 * pantalla de coche el arco se lee de reojo (la posición del extremo dice
 * cuánto queda sin necesidad de leer el número), y además rima con los dos
 * relojes grandes de los lados en vez de parecer un formulario.
 *
 * Ocupa la mitad que una tarjeta y se lee igual de bien, que es lo que
 * permite poner cinco magnitudes donde antes cabían cuatro tarjetas
 * dejando aire muerto alrededor.
 *
 * Anima por refs con requestAnimationFrame, sin re-render por fotograma.
 */
import { useRef } from "react";
import { clamp, useAnimatedNumber } from "./animation";
import { alfa, MBUX } from "./theme";

export interface MetricInlineProps {
  label: string;
  value: number;
  unit: string;
  min?: number;
  max: number;
  /** Valor a partir del cual el arco pasa a rojo. */
  danger?: number;
  decimals?: number;
  /** Icono SVG inline, dentro del arco. */
  icon?: React.ReactNode;
  /** Diámetro del arco en píxeles. */
  size?: number;
}

/** Barrido del arco en grados: abierto por abajo, como un reloj de coche. */
const BARRIDO = 250;
const RADIO = 44;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;
const LARGO = (BARRIDO / 360) * CIRCUNFERENCIA;

export function MetricInline({
  label,
  value,
  unit,
  min = 0,
  max,
  danger,
  decimals = 0,
  icon,
  size = 64,
}: MetricInlineProps) {
  const numeroRef = useRef<HTMLSpanElement>(null);
  const arcoRef = useRef<SVGCircleElement>(null);

  useAnimatedNumber(value, (v) => {
    if (numeroRef.current) numeroRef.current.textContent = v.toFixed(decimals);
    if (arcoRef.current) {
      const t = clamp((v - min) / (max - min), 0, 1);
      const rojo = danger !== undefined && v >= danger;
      arcoRef.current.setAttribute("stroke-dasharray", `${LARGO * t} ${CIRCUNFERENCIA}`);
      arcoRef.current.setAttribute("stroke", rojo ? MBUX.danger : MBUX.accent);
    }
  });

  return (
    <div className="flex min-w-0 flex-col items-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        {/* El arco se gira para que el hueco quede abajo y centrado. */}
        <svg viewBox="0 0 100 100" className="h-full w-full" style={{ rotate: "125deg" }}>
          <circle
            cx="50"
            cy="50"
            r={RADIO}
            fill="none"
            stroke={MBUX.track}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${LARGO} ${CIRCUNFERENCIA}`}
          />
          <circle
            ref={arcoRef}
            cx="50"
            cy="50"
            r={RADIO}
            fill="none"
            stroke={MBUX.accent}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`0 ${CIRCUNFERENCIA}`}
            style={{ filter: `drop-shadow(0 0 5px ${alfa("accent", 0.45)})` }}
          />
        </svg>

        {icon ? (
          <span className="absolute inset-0 flex items-center justify-center text-silver">
            {icon}
          </span>
        ) : null}
      </div>

      <span className="mt-0.5 flex items-baseline gap-1">
        <span
          ref={numeroRef}
          className="font-medium leading-none text-silver"
          style={{ fontSize: 24, fontVariantNumeric: "tabular-nums" }}
        >
          {value.toFixed(decimals)}
        </span>
        <span className="text-[11px] text-muted">{unit}</span>
      </span>

      <span className="mt-1 max-w-full truncate text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">
        {label}
      </span>

      {/* Subrayado corto: cierra el bloque y lo separa del de al lado. */}
      <span
        className="mt-1 h-[2px] w-8 rounded-full"
        style={{ background: alfa("accent", 0.55) }}
      />
    </div>
  );
}
