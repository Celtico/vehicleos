/**
 * RpmGauge — cuentarrevoluciones estilo MBUX con zona roja.
 */
import { GaugeArc } from "./GaugeArc";
import { MBUX } from "./theme";

export interface RpmGaugeProps {
  /** Régimen del motor en rpm. */
  rpm: number;
  /** Fondo de escala (por defecto 7000 rpm). */
  max?: number;
  /** Inicio de la zona roja (por defecto 5500 rpm). */
  redline?: number;
  size?: number;
}

export function RpmGauge({ rpm, max = 7000, redline = 5500, size = 300 }: RpmGaugeProps) {
  return (
    <GaugeArc
      value={rpm}
      min={0}
      max={max}
      size={size}
      label="Régimen"
      unit="rpm"
      color={MBUX.accent}
      zones={[{ from: redline, to: max, color: MBUX.danger }]}
      tickStep={1000}
      tickLabel={(v) => String(v / 1000)}
    />
  );
}
