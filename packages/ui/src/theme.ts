/**
 * Paleta y constantes visuales del cockpit estilo Mercedes MBUX moderno:
 * fondo negro con degradados sutiles, acentos cian-turquesa, plateados
 * y tipografía fina.
 */
/** Un color del tema, resuelto en tiempo de ejecución por CSS. */
function CSS(token: string): string {
  return `rgb(var(--c-${token}))`;
}

/**
 * El mismo color con transparencia.
 *
 * Antes se concatenaba el alfa al hexadecimal (`${MBUX.danger}26`), pero eso
 * deja de funcionar en cuanto el color es una variable: hay que componerlo.
 */
export function alfa(token: string, a: number): string {
  return `rgb(var(--c-${token}) / ${a})`;
}

export const MBUX = {
  /** Fondo base (negro azulado profundo). */
  bg: CSS("bg"),
  /** Degradado de pantalla completa. */
  bgGradient: "var(--c-fondo-degradado)",
  /** Fondo de paneles/tarjetas. */
  panel: "rgb(var(--c-panel) / var(--c-panel-a))",
  /** Borde sutil de paneles. */
  border: "1px solid rgb(var(--c-border) / var(--c-border-a))",
  /**
   * Sombra de las tarjetas. Va en variable y no en literal porque una sombra
   * negra al 45 %, que sobre fondo oscuro apenas se intuye, sobre fondo claro
   * rodea cada tarjeta de un cerco gris.
   */
  panelShadow: "var(--c-sombra-panel, 0 8px 30px rgba(0,0,0,0.45))",
  /** Velo superior de las tarjetas, el mismo que usa .panel-cockpit. */
  panelSheen:
    "linear-gradient(to bottom, rgb(var(--c-panel-luz, 255 255 255) / var(--c-panel-luz-a, 0.03)), transparent 62%)",
  /** Acento principal cian-turquesa MBUX. */
  accent: CSS("accent"),
  /** Acento atenuado (halos, pistas). */
  accentDim: alfa("accent", 0.35),
  /** Plateado para texto secundario brillante. */
  silver: CSS("silver"),
  /** Texto principal. */
  text: CSS("text"),
  /** Texto atenuado / etiquetas. */
  muted: CSS("muted"),
  /** Aviso (ámbar). */
  warning: CSS("warning"),
  /** Peligro (rojo). */
  danger: CSS("danger"),
  /** Correcto (verde suave). */
  ok: CSS("ok"),
  /** Pista de los gauges (gris grafito). */
  track: CSS("track"),
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
