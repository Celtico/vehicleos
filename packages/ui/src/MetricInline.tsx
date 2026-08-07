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
import { useId, useRef } from "react";
import { clamp, useAnimatedNumber } from "./animation";
import { alfa, MBUX } from "./theme";

export interface MetricInlineProps {
  label: string;
  value: number;
  unit: string;
  min?: number;
  max: number;
  /**
   * Valor a partir del cual el arco pasa a rojo, por arriba.
   * Para temperatura o presión, donde lo que preocupa es pasarse.
   */
  danger?: number;
  /**
   * Valor por debajo del cual el arco pasa a rojo.
   * Para combustible o tensión de batería, donde lo que preocupa es quedarse
   * corto: aplicarles `danger` los pintaba en rojo salvo cuando el depósito
   * estaba casi vacío, exactamente al revés.
   */
  dangerBelow?: number;
  /**
   * Valor a partir del cual el arco pasa a ámbar, antes de llegar al rojo.
   * Sin este escalón el indicador es binario: a 90 °C se ve igual de tranquilo
   * que a 40 y de golpe salta a rojo a los 105, sin que el conductor haya
   * podido verlo venir.
   */
  warn?: number;
  /** Equivalente por abajo (combustible, tensión). */
  warnBelow?: number;
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

/**
 * Tramo de la pista que corresponde a un intervalo de valores, para pintar la
 * zona de peligro sobre el propio arco. Sin la zona dibujada, el conductor no
 * tiene forma de saber si 90 °C está cerca o lejos del límite.
 */
function tramo(
  desde: number,
  hasta: number,
  min: number,
  max: number,
): { dash: string; offset: number } {
  const a = clamp((desde - min) / (max - min), 0, 1);
  const b = clamp((hasta - min) / (max - min), 0, 1);
  return { dash: `${LARGO * Math.max(0, b - a)} ${CIRCUNFERENCIA}`, offset: -LARGO * a };
}

export function MetricInline({
  label,
  value,
  unit,
  min = 0,
  max,
  danger,
  dangerBelow,
  warn,
  warnBelow,
  decimals = 0,
  icon,
  size = 64,
}: MetricInlineProps) {
  const uid = useId();
  const numeroRef = useRef<HTMLSpanElement>(null);
  const arcoRef = useRef<SVGCircleElement>(null);

  useAnimatedNumber(value, (v) => {
    if (numeroRef.current) numeroRef.current.textContent = v.toFixed(decimals);
    if (arcoRef.current) {
      const t = clamp((v - min) / (max - min), 0, 1);
      const rojo =
        (danger !== undefined && v >= danger) ||
        (dangerBelow !== undefined && v <= dangerBelow);
      const ambar =
        (warn !== undefined && v >= warn) || (warnBelow !== undefined && v <= warnBelow);
      arcoRef.current.setAttribute("stroke-dasharray", `${LARGO * t} ${CIRCUNFERENCIA}`);
      arcoRef.current.setAttribute(
        "stroke",
        rojo ? MBUX.danger : ambar ? MBUX.warning : MBUX.accent,
      );
    }
  });

  return (
    <div className="flex min-w-0 flex-col items-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        {/* El arco se gira para que el hueco quede abajo y centrado. */}
        <svg viewBox="0 0 100 100" className="h-full w-full" style={{ rotate: "125deg" }}>
          <defs>
            {/* El mismo fundido que los relojes grandes, para que las cinco
                magnitudes se lean como parte del mismo instrumento y no como
                cinco adornos sueltos. Va en máscara y no en el trazo porque el
                color cambia a rojo al cruzar el umbral. */}
            <linearGradient id={`${uid}-fundido`} x1="0.05" y1="0.95" x2="0.95" y2="0.15">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#fff" stopOpacity="1" />
            </linearGradient>
            <mask id={`${uid}-mascara`}>
              <rect x="0" y="0" width="100" height="100" fill={`url(#${uid}-fundido)`} />
            </mask>
          </defs>
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

          {/* Zonas de aviso y peligro, sobre la propia pista */}
          {[
            warn !== undefined
              ? { d: tramo(warn, danger ?? max, min, max), c: MBUX.warning }
              : null,
            warnBelow !== undefined
              ? { d: tramo(dangerBelow ?? min, warnBelow, min, max), c: MBUX.warning }
              : null,
            danger !== undefined ? { d: tramo(danger, max, min, max), c: MBUX.danger } : null,
            dangerBelow !== undefined
              ? { d: tramo(min, dangerBelow, min, max), c: MBUX.danger }
              : null,
          ]
            .filter((z) => z !== null)
            .map((z, i) => (
              <circle
                key={i}
                cx="50"
                cy="50"
                r={RADIO}
                fill="none"
                stroke={z.c}
                strokeWidth="7"
                strokeDasharray={z.d.dash}
                strokeDashoffset={z.d.offset}
                opacity={0.3}
              />
            ))}

          <circle
            mask={`url(#${uid}-mascara)`}
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
