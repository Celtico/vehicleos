/**
 * SpeedGauge — velocímetro grande estilo MBUX.
 */
import { GaugeArc } from "./GaugeArc";
import { MBUX } from "./theme";

export interface SpeedGaugeProps {
  /** Velocidad en km/h. */
  speed: number;
  /** Fondo de escala (por defecto 260 km/h). */
  max?: number;
  size?: number;
}

export function SpeedGauge({ speed, max = 260, size = 300 }: SpeedGaugeProps) {
  return (
    <GaugeArc
      value={speed}
      min={0}
      max={max}
      size={size}
      label="Velocidad"
      unit="km/h"
      color={MBUX.accent}
      tickStep={max / 13 >= 20 ? 40 : 20}
    />
  );
}
