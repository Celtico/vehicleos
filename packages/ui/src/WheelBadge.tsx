/**
 * WheelBadge — chip de datos que se dibuja junto a una rueda del modelo
 * cenital (p. ej. la presión TPMS "2.1 bar" o "—" si no hay dato).
 *
 * Se trata de un elemento SVG puro: sus coordenadas son las del `viewBox`
 * del `<svg>` contenedor, por lo que SOLO debe usarse dentro de un `<svg>`
 * (normalmente `VehicleModel`). El chip lleva un fondo opaco para que siga
 * siendo legible aunque quede sobre la carrocería.
 */
import { MBUX } from "./theme";

export interface WheelBadgeProps {
  /** Centro horizontal del chip, en coordenadas del viewBox. */
  x: number;
  /** Centro vertical del chip, en coordenadas del viewBox. */
  y: number;
  /** Texto mostrado (p. ej. "2.1 bar"). */
  text: string;
  /** Color del texto y del borde; por defecto el acento cian. */
  color?: string;
  /** Ancho del chip. */
  width?: number;
  /** Alto del chip. */
  height?: number;
  /** Tamaño de la tipografía del texto. */
  fontSize?: number;
}

/** Chip redondeado con fondo opaco para etiquetas de rueda. */
export function WheelBadge({
  x,
  y,
  text,
  color = MBUX.accent,
  width = 40,
  height = 15,
  fontSize = 8.4,
}: WheelBadgeProps) {
  return (
    <g pointerEvents="none">
      <rect
        x={x - width / 2}
        y={y - height / 2}
        width={width}
        height={height}
        rx={height / 2}
        fill="rgba(4,7,10,0.88)"
        stroke={color}
        strokeWidth={0.7}
        strokeOpacity={0.45}
      />
      <text
        x={x}
        y={y + 0.4}
        fill={color}
        fontSize={fontSize}
        fontWeight={400}
        letterSpacing={0.4}
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {text}
      </text>
    </g>
  );
}
