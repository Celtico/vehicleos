/**
 * Geometría de arcos SVG para los gauges circulares.
 */

/**
 * Convierte coordenadas polares (0° = arriba, sentido horario) a cartesianas.
 *
 * El redondeo a tres decimales no es cosmética: `Math.sin` y `Math.cos` no
 * garantizan el mismo último bit en Node y en el navegador, así que el HTML
 * del servidor y el del cliente salían con "63.68076002083626" frente a
 * "63.68076002083627" y React avisaba de discordancia al hidratar. A la
 * décima de milésima de una unidad de viewBox no lo ve nadie.
 */
export function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: Math.round((cx + r * Math.cos(rad)) * 1000) / 1000,
    y: Math.round((cy + r * Math.sin(rad)) * 1000) / 1000,
  };
}

/**
 * Camino SVG del arco entre `startAngle` y `endAngle` (grados, 0° arriba,
 * sentido horario, endAngle > startAngle).
 */
export function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${r} ${r} 0 ${largeArc} 0 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`;
}
