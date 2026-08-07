/**
 * Paleta y constantes visuales del cockpit estilo Mercedes MBUX moderno:
 * fondo negro con degradados sutiles, acentos cian-turquesa, plateados
 * y tipografía fina.
 */
export const MBUX = {
  /** Fondo base (negro azulado profundo). */
  bg: "#05080a",
  /** Degradado de pantalla completa. */
  bgGradient: "radial-gradient(120% 90% at 30% -10%, #0d181d 0%, #070c0f 45%, #04070a 100%)",
  /** Fondo de paneles/tarjetas. */
  panel:
    "linear-gradient(160deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.015) 60%, rgba(0,210,190,0.03) 100%)",
  /** Borde sutil de paneles. */
  border: "1px solid rgba(148,178,184,0.14)",
  /** Acento principal cian-turquesa MBUX. */
  accent: "#00d2be",
  /** Acento atenuado (halos, pistas). */
  accentDim: "rgba(0,210,190,0.35)",
  /** Plateado para texto secundario brillante. */
  silver: "#c8d2d6",
  /** Texto principal. */
  text: "#e8f0f2",
  /** Texto atenuado / etiquetas. */
  muted: "#9aadb4",
  /** Aviso (ámbar). */
  warning: "#ffb020",
  /** Peligro (rojo). */
  danger: "#ff4d5a",
  /** Correcto (verde suave). */
  ok: "#38e07d",
  /** Pista de los gauges (gris grafito). */
  track: "#1b2529",
  /** Familia tipográfica fina. */
  font: '"Helvetica Neue", -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
} as const;

/** Zona de color de un gauge (p. ej. zona roja de rpm). */
export interface GaugeZone {
  /** Valor donde empieza la zona. */
  from: number;
  /** Valor donde termina la zona. */
  to: number;
  /** Color de la zona. */
  color: string;
}

/** Devuelve el color de la zona que contiene `value`, o `fallback`. */
export function zoneColor(
  value: number,
  zones: GaugeZone[] | undefined,
  fallback: string,
): string {
  if (!zones) return fallback;
  const zone = zones.find((z) => value >= z.from && value <= z.to);
  return zone ? zone.color : fallback;
}
