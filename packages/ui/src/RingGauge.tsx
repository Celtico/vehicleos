/**
 * RingGauge — indicador de anillo compacto.
 *
 * Empaqueta una magnitud en mucho menos ancho que una tarjeta rectangular,
 * que es lo que permite llenar el cuadro sin dejar huecos muertos: en una
 * pantalla de coche el espacio vacío no es elegancia, es información que
 * cabía y no se puso.
 *
 * Anima con requestAnimationFrame mutando atributos por refs, sin
 * re-render por fotograma, como el resto de la instrumentación.
 */
import { useRef } from "react";
import { clamp, useAnimatedNumber } from "./animation";
import { alfa, MBUX } from "./theme";

export interface RingGaugeProps {
  /** Etiqueta bajo el anillo, p. ej. "TURBO". */
  label: string;
  value: number;
  unit: string;
  min?: number;
  max: number;
  /** Valor a partir del cual el anillo pasa a rojo. */
  danger?: number;
  /** Decimales del número. */
  decimals?: number;
  /** Diámetro en píxeles. */
  size?: number;
  /** Icono SVG inline, centrado sobre el número. */
  icon?: React.ReactNode;
}

/** Barrido del anillo en grados: abierto por abajo, como un reloj de coche. */
const BARRIDO = 260;

export function RingGauge({
  label,
  value,
  unit,
  min = 0,
  max,
  danger,
  decimals = 0,
  size = 96,
  icon,
}: RingGaugeProps) {
  const arcoRef = useRef<SVGCircleElement>(null);
  const numeroRef = useRef<HTMLSpanElement>(null);

  const radio = 42;
  const circunferencia = 2 * Math.PI * radio;
  // Longitud del trazo que corresponde al barrido visible.
  const largo = (BARRIDO / 360) * circunferencia;

  useAnimatedNumber(value, (v) => {
    if (numeroRef.current) numeroRef.current.textContent = v.toFixed(decimals);
    if (arcoRef.current) {
      const t = clamp((v - min) / (max - min), 0, 1);
      arcoRef.current.setAttribute("stroke-dasharray", `${largo * t} ${circunferencia}`);
      arcoRef.current.setAttribute(
        "stroke",
        danger !== undefined && v >= danger ? MBUX.danger : MBUX.accent,
      );
    }
  });

  return (
    <div className="flex flex-col items-center gap-1" style={{ width: size }}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-[130deg]">
          {/* Pista */}
          <circle
            cx="50"
            cy="50"
            r={radio}
            fill="none"
            stroke={MBUX.track}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${largo} ${circunferencia}`}
          />
          {/* Progreso */}
          <circle
            ref={arcoRef}
            cx="50"
            cy="50"
            r={radio}
            fill="none"
            stroke={MBUX.accent}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`0 ${circunferencia}`}
            style={{ filter: `drop-shadow(0 0 5px ${alfa("accent", 0.45)})` }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          {icon ? <span className="text-muted">{icon}</span> : null}
          <span className="flex items-baseline gap-0.5">
            <span
              ref={numeroRef}
              className="font-medium leading-none text-silver"
              style={{ fontSize: size * 0.24, fontVariantNumeric: "tabular-nums" }}
            >
              {value.toFixed(decimals)}
            </span>
            <span className="text-[10px] text-muted">{unit}</span>
          </span>
        </div>
      </div>

      <span className="text-center text-[10.5px] font-semibold uppercase leading-tight tracking-[0.06em] text-muted">
        {label}
      </span>
    </div>
  );
}
