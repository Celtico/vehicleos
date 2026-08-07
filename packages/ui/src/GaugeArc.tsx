/**
 * GaugeArc — reloj de instrumentación grande, estilo cuadro de coche.
 *
 * Bisel circular completo, escala de 270° con marcas mayores rotuladas y
 * menores sin rotular, arco de progreso grueso y un testigo brillante en el
 * valor actual. El número va dentro, con la unidad debajo: no lleva rótulo
 * inferior porque en un cuadro de coche el velocímetro no necesita que le
 * pongan "velocidad" al lado (el nombre accesible sí lo lleva).
 *
 * El progreso, el testigo y el número se animan con requestAnimationFrame
 * (ver `useAnimatedNumber`): React solo renderiza la carcasa estática; cada
 * frame muta atributos SVG mediante refs.
 */
import { useId, useMemo, useRef } from "react";
import { clamp, useAnimatedNumber } from "./animation";
import { describeArc, polarToCartesian } from "./arc";
import { alfa, MBUX, zoneColor, type GaugeZone } from "./theme";

/** Ángulos del arco (0° = arriba): de -135° a +135° → barrido de 270°. */
const START = -135;
const END = 135;
const SWEEP = END - START;

/** Radios en unidades del viewBox (200×200, centro en 100,100). */
const R_BISEL = 96;
const R_ZONA = 90;
const R_ARCO = 90;
const R_MARCA_FUERA = 80;
const R_MARCA_MAYOR = 73;
const R_MARCA_MENOR = 75;
const R_ROTULO = 60;

export interface GaugeArcProps {
  /** Último valor recibido (objetivo de la animación). */
  value: number;
  min?: number;
  max?: number;
  /** Nombre accesible (p. ej. "Velocidad"). No se dibuja. */
  label?: string;
  /** Unidad mostrada bajo el número (p. ej. "km/h"). */
  unit?: string;
  /** Lado del SVG en píxeles. */
  size?: number;
  /** Color base del progreso. */
  color?: string;
  /** Zonas de color sobre el bisel (p. ej. zona roja). */
  zones?: GaugeZone[];
  /** Distancia entre marcas mayores (en unidades del valor). */
  tickStep?: number;
  /** Marcas menores por cada tramo entre mayores. */
  minorPerStep?: number;
  /** Formatea la etiqueta de cada marca mayor. */
  tickLabel?: (v: number) => string;
  /** Formatea el número central. */
  format?: (v: number) => string;
}

export function GaugeArc({
  value,
  min = 0,
  max = 100,
  label,
  unit,
  size = 300,
  color = MBUX.accent,
  zones,
  tickStep,
  minorPerStep = 4,
  tickLabel = (v) => String(Math.round(v)),
  format = (v) => String(Math.round(v)),
}: GaugeArcProps) {
  const uid = useId();
  const progressRef = useRef<SVGPathElement | null>(null);
  const glowRef = useRef<SVGPathElement | null>(null);
  const marcaRef = useRef<SVGLineElement | null>(null);
  const textRef = useRef<SVGTextElement | null>(null);

  const range = max - min || 1;

  // Frame de animación: arco, testigo de posición y número central.
  useAnimatedNumber(value, (v) => {
    const frac = clamp((v - min) / range, 0, 1);
    const endAngle = START + Math.max(0.5, frac * SWEEP);
    const d = describeArc(100, 100, R_ARCO, START, endAngle);
    const stroke = zoneColor(v, zones, color);
    const visible = frac < 0.004 ? "0" : "1";

    if (progressRef.current) {
      progressRef.current.setAttribute("d", d);
      progressRef.current.setAttribute("stroke", stroke);
      progressRef.current.setAttribute("opacity", visible);
    }
    if (glowRef.current) {
      glowRef.current.setAttribute("d", d);
      glowRef.current.setAttribute("stroke", stroke);
      glowRef.current.setAttribute("opacity", frac < 0.004 ? "0" : "0.3");
    }
    if (marcaRef.current) {
      const a = polarToCartesian(100, 100, R_ARCO + 6, endAngle);
      const b = polarToCartesian(100, 100, R_MARCA_FUERA - 3, endAngle);
      marcaRef.current.setAttribute("x1", String(a.x));
      marcaRef.current.setAttribute("y1", String(a.y));
      marcaRef.current.setAttribute("x2", String(b.x));
      marcaRef.current.setAttribute("y2", String(b.y));
      marcaRef.current.setAttribute("stroke", stroke);
      marcaRef.current.setAttribute("opacity", visible);
    }
    if (textRef.current) textRef.current.textContent = format(v);
  });

  // Marcas y zonas: estáticas, se calculan una sola vez.
  const marcas = useMemo(() => {
    if (!tickStep) return { mayores: [], menores: [] };
    const mayores: { angle: number; label: string }[] = [];
    const menores: number[] = [];
    const paso = tickStep / Math.max(1, minorPerStep);
    for (let v = min; v <= max + 1e-9; v += tickStep) {
      mayores.push({
        angle: START + ((v - min) / range) * SWEEP,
        label: tickLabel(v),
      });
    }
    for (let v = min; v <= max + 1e-9; v += paso) {
      // Las menores que coinciden con una mayor no se dibujan dos veces.
      const resto = (v - min) % tickStep;
      if (Math.min(resto, tickStep - resto) < paso / 4) continue;
      menores.push(START + ((v - min) / range) * SWEEP);
    }
    return { mayores, menores };
  }, [min, max, range, tickStep, minorPerStep, tickLabel]);

  const zonePaths = useMemo(
    () =>
      (zones ?? []).map((z) => ({
        d: describeArc(
          100,
          100,
          R_ZONA,
          START + ((clamp(z.from, min, max) - min) / range) * SWEEP,
          START + ((clamp(z.to, min, max) - min) / range) * SWEEP,
        ),
        color: z.color,
      })),
    [zones, min, max, range],
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role="meter"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      // overflow visible: el halo desenfocado del arco sobresale del viewBox
      // y un SVG recorta por defecto; sin esto el resplandor sale cortado en
      // una línea recta por los bordes.
      style={{ display: "block", fontFamily: MBUX.font, overflow: "visible" }}
    >
      <defs>
        {/* Región generosa: con el arco corto (valor bajo) su caja es pequeña
            y un margen del 40 % no le llegaba a la cola del desenfoque, que
            aparecía cortada en un rectángulo. */}
        <filter id={`${uid}-blur`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="5" />
        </filter>

        {/* Esfera: clara arriba y oscureciéndose hacia abajo, a juego con la
            luz cenital del resto del cockpit (los paneles y el coche 3D
            reciben la luz por arriba). Los colores salen del tema, así que
            cambia de día a noche sin tocar nada aquí. */}
        <radialGradient id={`${uid}-esfera`} cx="0.5" cy="0.12" r="0.95">
          <stop offset="0%" stopColor="var(--c-esfera-0)" />
          <stop offset="45%" stopColor="var(--c-esfera-1)" />
          {/* El pie de la esfera se disuelve: el fondo del cockpit (y el
              coche 3D) asoman por debajo, igual que hace el bisel. */}
          <stop offset="100%" stopColor="var(--c-esfera-2)" stopOpacity="0" />
        </radialGradient>

        {/* Máscara del arco: el relleno gana cuerpo según avanza, en lugar de
            aparecer de golpe a plena intensidad. Va en la máscara y no en el
            trazo a propósito: el color del arco cambia (turquesa o rojo según
            la zona) y una máscara es indiferente al color. */}
        <linearGradient id={`${uid}-fundido`} x1="0.06" y1="0.96" x2="0.94" y2="0.2">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="55%" stopColor="#fff" stopOpacity="0.88" />
          <stop offset="100%" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <mask id={`${uid}-mascara`}>
          <rect x="0" y="0" width="200" height="200" fill={`url(#${uid}-fundido)`} />
        </mask>

        {/* Bisel: un aro que recoge la luz arriba y se DISUELVE del todo por
            abajo (transparente), no una línea de grosor constante. A trazo
            plano, en tema claro el borde es casi negro y encierra el reloj
            en un contorno duro. */}
        <linearGradient id={`${uid}-bisel`} x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor={`rgb(var(--c-border) / 0.34)`} />
          <stop offset="45%" stopColor={`rgb(var(--c-border) / 0.14)`} />
          <stop offset="100%" stopColor={`rgb(var(--c-border) / 0)`} />
        </linearGradient>
      </defs>

      {/* Esfera */}
      <circle cx="100" cy="100" r={R_BISEL} fill={`url(#${uid}-esfera)`} />

      {/* Bisel */}
      <circle
        cx="100"
        cy="100"
        r={R_BISEL}
        fill="none"
        stroke={`url(#${uid}-bisel)`}
        strokeWidth={1.2}
      />

      {/* Pista del arco */}
      <path
        d={describeArc(100, 100, R_ARCO, START, END)}
        fill="none"
        stroke={MBUX.track}
        strokeWidth={9}
        strokeLinecap="round"
      />

      {/* Zonas de color, sobre la propia pista. Remate redondo: la pista
          termina en punta redonda y una zona con corte plano en el mismo
          ángulo se veía cortada a cuchillo. */}
      {zonePaths.map((z, i) => (
        <path
          key={i}
          d={z.d}
          fill="none"
          stroke={z.color}
          strokeWidth={9}
          strokeLinecap="round"
          opacity={0.9}
        />
      ))}

      {/* Halo del progreso */}
      <g mask={`url(#${uid}-mascara)`}>
        <path
          ref={glowRef}
          fill="none"
          stroke={color}
          strokeWidth={17}
          strokeLinecap="round"
          filter={`url(#${uid}-blur)`}
          opacity={0}
        />
        {/* Arco de progreso animado */}
        <path
          ref={progressRef}
          fill="none"
          stroke={color}
          strokeWidth={9}
          strokeLinecap="round"
          opacity={0}
        />
      </g>

      {/* Testigo del valor actual. Va fuera del fundido: marca dónde está la
          aguja ahora mismo y tiene que verse igual de fuerte siempre. */}
      <line ref={marcaRef} stroke={color} strokeWidth={2.2} strokeLinecap="round" opacity={0} />

      {/* Marcas menores */}
      {marcas.menores.map((a, i) => {
        const p1 = polarToCartesian(100, 100, R_MARCA_FUERA, a);
        const p2 = polarToCartesian(100, 100, R_MARCA_MENOR, a);
        return (
          <line
            key={`m${i}`}
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke={alfa("muted", 0.3)}
            strokeWidth={1}
          />
        );
      })}

      {/* Marcas mayores y sus rótulos */}
      {marcas.mayores.map((t, i) => {
        const p1 = polarToCartesian(100, 100, R_MARCA_FUERA, t.angle);
        const p2 = polarToCartesian(100, 100, R_MARCA_MAYOR, t.angle);
        const pt = polarToCartesian(100, 100, R_ROTULO, t.angle);
        return (
          <g key={i}>
            <line
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={alfa("silver", 0.55)}
              strokeWidth={1.6}
            />
            <text
              x={pt.x}
              y={pt.y}
              fill={MBUX.silver}
              fontSize={11}
              fontWeight={400}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {t.label}
            </text>
          </g>
        );
      })}

      {/* Número central animado */}
      <text
        ref={textRef}
        x={100}
        y={96}
        fill={MBUX.text}
        fontSize={34}
        fontWeight={300}
        letterSpacing={-1}
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {format(value)}
      </text>
      {unit ? (
        <text
          x={100}
          y={118}
          fill={MBUX.muted}
          fontSize={11}
          fontWeight={400}
          textAnchor="middle"
        >
          {unit}
        </text>
      ) : null}
    </svg>
  );
}
