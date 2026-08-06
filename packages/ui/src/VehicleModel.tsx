/**
 * VehicleModel — representación cenital (top-down) del vehículo con piezas
 * direccionables que se iluminan según el estado real del coche.
 *
 * El dibujo es arte original: un cupé genérico y estilizado, sin logotipos ni
 * referencias a ningún modelo concreto. Estética del cockpit: fondo negro,
 * acentos cian-turquesa, líneas finas y halos suaves.
 *
 * Como en el resto de la instrumentación, el calor del vano motor NO provoca
 * re-render por frame: `useAnimatedNumber` interpola con requestAnimationFrame
 * y muta directamente los atributos SVG del capó a través de refs. El pulso de
 * las piezas en avería se resuelve con SMIL (`<animate>`), igual que en
 * `StatusLight`.
 */
import { useId, useMemo, useRef, type KeyboardEvent } from "react";
import { clamp, useAnimatedNumber } from "./animation";
import { MBUX } from "./theme";
import { WheelBadge } from "./WheelBadge";

/** Piezas del vehículo que pueden resaltarse individualmente. */
export type VehiclePartId =
  | "engine"
  | "body"
  | "wheel-fl"
  | "wheel-fr"
  | "wheel-rl"
  | "wheel-rr"
  | "door-fl"
  | "door-fr"
  | "door-rl"
  | "door-rr";

/** Gravedad del estado de una pieza. */
export type PartSeverity = "ok" | "info" | "warning" | "error";

export interface VehicleModelProps {
  /** Ancho del componente en píxeles (pensado para 280–520). */
  size?: number;
  /** Estado por pieza; las ausentes se consideran "ok". */
  parts?: Partial<Record<VehiclePartId, PartSeverity>>;
  /** 0-100: intensidad del calor del vano motor (tiñe el capó de cian→ámbar→rojo). */
  engineHeat?: number;
  /** Etiqueta opcional bajo cada rueda, p.ej. presión TPMS ("2.1 bar") o "—". */
  wheelLabels?: Partial<Record<"fl" | "fr" | "rl" | "rr", string>>;
  /** Callback al tocar una pieza (para abrir el detalle de la avería). */
  onPartClick?: (part: VehiclePartId) => void;
}

/* -------------------------------------------------------------------------- */
/* Geometría                                                                   */
/* -------------------------------------------------------------------------- */

/** Lienzo en coordenadas de usuario (el coche mira hacia arriba). */
const VB_W = 240;
const VB_H = 340;

/** Silueta de la carrocería: morro redondeado, caderas marcadas y cola corta. */
const BODY_PATH =
  "M 120 26 C 142 26 163 42 168 68 C 173 94 176 140 176 188 " +
  "C 176 240 173 282 166 298 C 159 312 140 316 120 316 " +
  "C 100 316 81 312 74 298 C 67 282 64 240 64 188 " +
  "C 64 140 67 94 72 68 C 77 42 98 26 120 26 Z";

/** Capó / vano motor. */
const HOOD_PATH = "M 88 58 Q 120 51 152 58 L 161 114 Q 120 108 79 114 Z";

/** Parabrisas (base ancha en el cortavientos, estrecha en el techo). */
const WINDSHIELD_PATH = "M 83 120 Q 120 115 157 120 L 149 152 Q 120 149 91 152 Z";

/** Techo. */
const ROOF_PATH = "M 91 154 L 149 154 Q 151 186 149 216 L 91 216 Q 89 186 91 154 Z";

/** Luneta trasera. */
const REAR_GLASS_PATH = "M 91 219 L 149 219 L 157 250 Q 120 246 83 250 Z";

/**
 * Paneles de puerta, entre el flanco de la carrocería y el habitáculo. El
 * canto exterior se curva siguiendo la silueta para que el resalte de estado
 * quede pegado al contorno del coche.
 */
const DOOR_FL_PATH = "M 67.5 128 L 88 133 L 88 194 L 65.5 194 Q 64.8 160 67.5 128 Z";
const DOOR_RL_PATH = "M 65.5 198 L 88 198 L 88 239 L 66 239 Q 64.6 218 65.5 198 Z";
const DOOR_FR_PATH = "M 172.5 128 L 152 133 L 152 194 L 174.5 194 Q 175.2 160 172.5 128 Z";
const DOOR_RR_PATH = "M 174.5 198 L 152 198 L 152 239 L 174 239 Q 175.4 218 174.5 198 Z";

/** Devuelve el `d` de un rectángulo con esquinas redondeadas. */
function roundedRect(x: number, y: number, w: number, h: number, r: number): string {
  return (
    `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} ` +
    `V ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} ` +
    `H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + h - r} ` +
    `V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`
  );
}

/** Tamaño del neumático visto desde arriba. */
const WHEEL_W = 20;
const WHEEL_H = 48;

/**
 * Ruedas: asoman por fuera del paso de rueda, como en una vista cenital real.
 * Cada entrada lleva su esquina, la pieza asociada, el rectángulo del neumático
 * y el centro del chip de etiqueta que se dibuja justo debajo.
 */
const WHEELS = [
  { corner: "fl", part: "wheel-fl", x: 56, y: 72, badge: { x: 62, y: 132 } },
  { corner: "fr", part: "wheel-fr", x: 164, y: 72, badge: { x: 178, y: 132 } },
  { corner: "rl", part: "wheel-rl", x: 54, y: 242, badge: { x: 60, y: 302 } },
  { corner: "rr", part: "wheel-rr", x: 166, y: 242, badge: { x: 180, y: 302 } },
] as const satisfies readonly {
  corner: "fl" | "fr" | "rl" | "rr";
  part: VehiclePartId;
  x: number;
  y: number;
  badge: { x: number; y: number };
}[];

/** Contorno del neumático de una rueda. */
function tyrePath(w: { x: number; y: number }): string {
  return roundedRect(w.x, w.y, WHEEL_W, WHEEL_H, 7);
}

/** Contorno de la llanta insinuada dentro del neumático. */
function rimPath(w: { x: number; y: number }): string {
  return roundedRect(w.x + 5, w.y + 11, WHEEL_W - 10, WHEEL_H - 22, 4);
}

const WHEEL_FL_PATH = tyrePath(WHEELS[0]);
const WHEEL_FR_PATH = tyrePath(WHEELS[1]);
const WHEEL_RL_PATH = tyrePath(WHEELS[2]);
const WHEEL_RR_PATH = tyrePath(WHEELS[3]);

/** Orden de las piezas interactivas: la carrocería va primero para que las
 *  puertas y ruedas (dibujadas encima) capturen sus propios clics. */
const PART_SHAPES = [
  { part: "body", d: BODY_PATH },
  { part: "engine", d: HOOD_PATH },
  { part: "door-fl", d: DOOR_FL_PATH },
  { part: "door-fr", d: DOOR_FR_PATH },
  { part: "door-rl", d: DOOR_RL_PATH },
  { part: "door-rr", d: DOOR_RR_PATH },
  { part: "wheel-fl", d: WHEEL_FL_PATH },
  { part: "wheel-fr", d: WHEEL_FR_PATH },
  { part: "wheel-rl", d: WHEEL_RL_PATH },
  { part: "wheel-rr", d: WHEEL_RR_PATH },
] as const satisfies readonly { part: VehiclePartId; d: string }[];

/* -------------------------------------------------------------------------- */
/* Estado y colores                                                            */
/* -------------------------------------------------------------------------- */

/** Nombre en español de cada pieza (para `aria-label` y `title`). */
const PART_LABELS: Record<VehiclePartId, string> = {
  engine: "Motor",
  body: "Carrocería",
  "wheel-fl": "Rueda delantera izquierda",
  "wheel-fr": "Rueda delantera derecha",
  "wheel-rl": "Rueda trasera izquierda",
  "wheel-rr": "Rueda trasera derecha",
  "door-fl": "Puerta delantera izquierda",
  "door-fr": "Puerta delantera derecha",
  "door-rl": "Puerta trasera izquierda",
  "door-rr": "Puerta trasera derecha",
};

/** Descripción en español de cada gravedad. */
const SEVERITY_LABELS: Record<PartSeverity, string> = {
  ok: "estado correcto",
  info: "información disponible",
  warning: "aviso",
  error: "avería",
};

/** Color de resalte por gravedad (paleta de `theme.ts`). */
const SEVERITY_COLOR: Record<PartSeverity, string> = {
  ok: MBUX.ok,
  info: MBUX.accent,
  warning: MBUX.warning,
  error: MBUX.danger,
};

/** Opacidad del relleno de resalte por gravedad. */
const SEVERITY_FILL: Record<PartSeverity, number> = {
  ok: 0,
  info: 0.13,
  warning: 0.2,
  error: 0.26,
};

/** Convierte "#rrggbb" a componentes RGB. */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Mezcla lineal de dos colores hexadecimales (`t` en 0..1). */
function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const byte = (x: number) =>
    Math.round(clamp(x, 0, 255))
      .toString(16)
      .padStart(2, "0");
  return `#${byte(ar + (br - ar) * t)}${byte(ag + (bg - ag) * t)}${byte(ab + (bb - ab) * t)}`;
}

/** Color del calor del vano motor: cian (frío) → ámbar (caliente) → rojo. */
function heatColor(heat: number): string {
  const t = clamp(heat, 0, 100) / 100;
  return t <= 0.55
    ? mixHex(MBUX.accent, MBUX.warning, t / 0.55)
    : mixHex(MBUX.warning, MBUX.danger, (t - 0.55) / 0.45);
}

/* -------------------------------------------------------------------------- */
/* Capa interactiva de una pieza                                               */
/* -------------------------------------------------------------------------- */

interface PartOverlayProps {
  partId: VehiclePartId;
  d: string;
  severity: PartSeverity;
  /** Filtro de desenfoque compartido para el halo. */
  glowFilter: string;
  onActivate?: (part: VehiclePartId) => void;
}

/**
 * Resalte y zona sensible de una pieza. En `ok` solo aporta el área de clic;
 * en `warning`/`error` añade relleno, contorno y halo, y en `error` el
 * conjunto late suavemente mediante SMIL.
 */
function PartOverlay({ partId, d, severity, glowFilter, onActivate }: PartOverlayProps) {
  const color = SEVERITY_COLOR[severity];
  const active = severity !== "ok";
  const isError = severity === "error";
  const interactive = typeof onActivate === "function";
  const label = `${PART_LABELS[partId]}: ${SEVERITY_LABELS[severity]}`;

  const activate = () => onActivate?.(partId);
  const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      activate();
    }
  };

  return (
    <g
      data-vm-part={partId}
      role={interactive ? "button" : active ? "img" : undefined}
      aria-label={interactive || active ? label : undefined}
      aria-hidden={!interactive && !active ? true : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? activate : undefined}
      onKeyDown={interactive ? onKeyDown : undefined}
      pointerEvents={interactive ? "auto" : "none"}
      style={interactive ? { cursor: "pointer" } : undefined}
    >
      {interactive ? <title>{label}</title> : null}

      {active ? (
        <>
          {/* Halo ambiental de la pieza */}
          <path
            d={d}
            fill="none"
            stroke={color}
            strokeWidth={6}
            opacity={isError ? 0.3 : 0.22}
            filter={glowFilter}
            pointerEvents="none"
          >
            {isError ? (
              <animate
                attributeName="opacity"
                values="0.42;0.12;0.42"
                dur="1.1s"
                repeatCount="indefinite"
              />
            ) : null}
          </path>
          {/* Relleno tintado */}
          <path d={d} fill={color} opacity={SEVERITY_FILL[severity]} pointerEvents="none">
            {isError ? (
              <animate
                attributeName="opacity"
                values="0.34;0.1;0.34"
                dur="1.1s"
                repeatCount="indefinite"
              />
            ) : null}
          </path>
          {/* Contorno */}
          <path
            d={d}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeLinejoin="round"
            opacity={0.92}
            pointerEvents="none"
          >
            {isError ? (
              <animate
                attributeName="opacity"
                values="1;0.45;1"
                dur="1.1s"
                repeatCount="indefinite"
              />
            ) : null}
          </path>
        </>
      ) : null}

      {/* Zona sensible + realces de hover/foco (controlados por CSS) */}
      <path
        className="vm-hit"
        d={d}
        fill={interactive ? "transparent" : "none"}
        stroke="none"
      />
      {interactive ? (
        <>
          <path
            className="vm-hover"
            d={d}
            fill={MBUX.accent}
            opacity={0}
            pointerEvents="none"
          />
          <path
            className="vm-focus"
            d={d}
            fill="none"
            stroke={MBUX.accent}
            strokeWidth={2}
            strokeDasharray="5 3"
            strokeLinejoin="round"
            opacity={0}
            pointerEvents="none"
          />
        </>
      ) : null}
    </g>
  );
}

/* -------------------------------------------------------------------------- */
/* Componente principal                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Coche cenital con piezas direccionables.
 *
 * @example
 * <VehicleModel
 *   size={420}
 *   engineHeat={72}
 *   parts={{ "wheel-fr": "error", engine: "warning" }}
 *   wheelLabels={{ fl: "2.3 bar", fr: "1.4 bar", rl: "2.4 bar", rr: "2.4 bar" }}
 *   onPartClick={(p) => abrirDetalle(p)}
 * />
 */
export function VehicleModel({
  size = 380,
  parts,
  engineHeat = 0,
  wheelLabels,
  onPartClick,
}: VehicleModelProps) {
  // `useId` puede devolver caracteres no válidos en un selector CSS (":r1:").
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const hoodHeatRef = useRef<SVGPathElement | null>(null);
  const hoodGlowRef = useRef<SVGPathElement | null>(null);

  const severityOf = (part: VehiclePartId): PartSeverity => parts?.[part] ?? "ok";
  const anyActive = useMemo(
    () => PART_SHAPES.some((s) => (parts?.[s.part] ?? "ok") !== "ok"),
    [parts],
  );

  // Calor del vano motor: interpolado a 60 FPS mutando atributos, sin re-render.
  useAnimatedNumber(
    clamp(engineHeat, 0, 100),
    (v) => {
      const color = heatColor(v);
      const t = clamp(v, 0, 100) / 100;
      if (hoodHeatRef.current) {
        hoodHeatRef.current.setAttribute("fill", color);
        hoodHeatRef.current.setAttribute("opacity", (0.05 + t * 0.34).toFixed(3));
      }
      if (hoodGlowRef.current) {
        hoodGlowRef.current.setAttribute("stroke", color);
        hoodGlowRef.current.setAttribute("opacity", (t * t * 0.65).toFixed(3));
      }
    },
    260,
  );

  const glowFilter = `url(#${uid}-glow)`;
  const height = Math.round((size * VB_H) / VB_W);

  // Hover y foco de teclado, acotados a este SVG por su id.
  const css =
    `#${uid}-svg [data-vm-part] { outline: none; }\n` +
    `#${uid}-svg [data-vm-part] .vm-hover { transition: opacity 140ms ease; }\n` +
    `#${uid}-svg [data-vm-part]:hover .vm-hover { opacity: 0.1; }\n` +
    `#${uid}-svg [data-vm-part]:focus-visible .vm-focus { opacity: 0.95; }`;

  return (
    <svg
      id={`${uid}-svg`}
      width={size}
      height={height}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      role="img"
      aria-label={
        anyActive
          ? "Esquema del vehículo con piezas en aviso o avería"
          : "Esquema del vehículo, todas las piezas correctas"
      }
      style={{ display: "block", overflow: "visible", fontFamily: MBUX.font }}
    >
      <style>{css}</style>

      <defs>
        {/* Chapa metálica oscura iluminada desde arriba a la izquierda */}
        <linearGradient id={`${uid}-paint`} x1="0.12" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#28373d" />
          <stop offset="34%" stopColor="#172328" />
          <stop offset="72%" stopColor="#0c1418" />
          <stop offset="100%" stopColor="#1a272c" />
        </linearGradient>
        {/* Cristales */}
        <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#0d2228" />
          <stop offset="100%" stopColor="#050c0f" />
        </linearGradient>
        {/* Capó base (algo más claro que el resto de la chapa) */}
        <linearGradient id={`${uid}-hood`} x1="0.2" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#233238" />
          <stop offset="100%" stopColor="#101a1e" />
        </linearGradient>
        {/* Reflejo especular del techo */}
        <linearGradient id={`${uid}-spec`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.16} />
          <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
        </linearGradient>
        {/* Brillo difuso sobre el flanco izquierdo */}
        <radialGradient id={`${uid}-sheen`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.075} />
          <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
        </radialGradient>
        {/* Luz ambiental reflejada en el suelo */}
        <radialGradient id={`${uid}-ground`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor={MBUX.accent} stopOpacity={0.1} />
          <stop offset="58%" stopColor={MBUX.accent} stopOpacity={0.03} />
          <stop offset="100%" stopColor={MBUX.accent} stopOpacity={0} />
        </radialGradient>
        {/* Neumático */}
        <linearGradient id={`${uid}-tyre`} x1="0" y1="0" x2="1" y2="0.3">
          <stop offset="0%" stopColor="#141c20" />
          <stop offset="100%" stopColor="#05090b" />
        </linearGradient>
        {/* Ópticas */}
        <linearGradient id={`${uid}-head`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#dff7f4" stopOpacity={0.85} />
          <stop offset="100%" stopColor={MBUX.accent} stopOpacity={0.45} />
        </linearGradient>

        <filter id={`${uid}-glow`} x="-45%" y="-45%" width="190%" height="190%">
          <feGaussianBlur stdDeviation="3.5" />
        </filter>
        <filter id={`${uid}-soft`} x="-45%" y="-45%" width="190%" height="190%">
          <feGaussianBlur stdDeviation="7" />
        </filter>

        <clipPath id={`${uid}-clip-body`}>
          <path d={BODY_PATH} />
        </clipPath>
        <clipPath id={`${uid}-clip-roof`}>
          <path d={ROOF_PATH} />
        </clipPath>
      </defs>

      {/* ---------------------------------------------------------------- */}
      {/* Suelo: luz ambiental y sombra de contacto                         */}
      {/* ---------------------------------------------------------------- */}
      <ellipse cx={120} cy={182} rx={94} ry={160} fill={`url(#${uid}-ground)`} />
      <path
        d={BODY_PATH}
        fill="#000000"
        opacity={0.85}
        filter={`url(#${uid}-soft)`}
        transform="translate(0 10)"
      />

      {/* ---------------------------------------------------------------- */}
      {/* Carrocería                                                        */}
      {/* ---------------------------------------------------------------- */}
      {/* Contorno cian tenue: el coche "en reposo" nunca queda apagado del todo */}
      <path
        d={BODY_PATH}
        fill="none"
        stroke={MBUX.accent}
        strokeWidth={4}
        opacity={anyActive ? 0.11 : 0.19}
        filter={glowFilter}
      />
      <path
        d={BODY_PATH}
        fill={`url(#${uid}-paint)`}
        stroke={MBUX.accentDim}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <g clipPath={`url(#${uid}-clip-body)`}>
        <ellipse cx={76} cy={124} rx={48} ry={152} fill={`url(#${uid}-sheen)`} />
        <ellipse cx={172} cy={250} rx={30} ry={110} fill={`url(#${uid}-sheen)`} opacity={0.6} />
      </g>

      {/* Ópticas delanteras */}
      <path d="M 129 34 Q 142 37 150 46 Q 140 42 128 40 Z" fill={`url(#${uid}-head)`} />
      <path d="M 111 34 Q 98 37 90 46 Q 100 42 112 40 Z" fill={`url(#${uid}-head)`} />
      {/* Pilotos traseros */}
      <path
        d="M 130 300 Q 143 297 153 291 Q 148 301 132 307 Z"
        fill={MBUX.danger}
        opacity={0.5}
      />
      <path d="M 110 300 Q 97 297 87 291 Q 92 301 108 307 Z" fill={MBUX.danger} opacity={0.5} />

      {/* ---------------------------------------------------------------- */}
      {/* Capó / vano motor (base + tinte de calor animado)                 */}
      {/* ---------------------------------------------------------------- */}
      <path
        ref={hoodGlowRef}
        d={HOOD_PATH}
        fill="none"
        stroke={MBUX.accent}
        strokeWidth={7}
        opacity={0}
        filter={glowFilter}
      />
      <path
        d={HOOD_PATH}
        fill={`url(#${uid}-hood)`}
        stroke="rgba(148,178,184,0.2)"
        strokeWidth={0.9}
        strokeLinejoin="round"
      />
      <path ref={hoodHeatRef} d={HOOD_PATH} fill={MBUX.accent} opacity={0.06} />
      {/* Nervios del capó */}
      <path
        d="M 103 62 L 99 110 M 137 62 L 141 110"
        stroke="rgba(200,214,218,0.13)"
        strokeWidth={0.9}
        fill="none"
      />

      {/* ---------------------------------------------------------------- */}
      {/* Habitáculo: parabrisas, techo con reflejo y luneta                */}
      {/* ---------------------------------------------------------------- */}
      <path
        d={WINDSHIELD_PATH}
        fill={`url(#${uid}-glass)`}
        stroke="rgba(0,210,190,0.22)"
        strokeWidth={0.9}
        strokeLinejoin="round"
      />
      <path
        d={ROOF_PATH}
        fill={`url(#${uid}-paint)`}
        stroke="rgba(148,178,184,0.22)"
        strokeWidth={0.9}
        strokeLinejoin="round"
      />
      <g clipPath={`url(#${uid}-clip-roof)`}>
        {/* Reflejo especular diagonal sobre el techo */}
        <path d="M 84 150 L 122 150 L 100 222 L 74 222 Z" fill={`url(#${uid}-spec)`} />
        <path
          d="M 130 150 L 142 150 L 122 222 L 112 222 Z"
          fill={`url(#${uid}-spec)`}
          opacity={0.45}
        />
      </g>
      <path
        d={REAR_GLASS_PATH}
        fill={`url(#${uid}-glass)`}
        stroke="rgba(0,210,190,0.2)"
        strokeWidth={0.9}
        strokeLinejoin="round"
      />

      {/* ---------------------------------------------------------------- */}
      {/* Puertas y retrovisores                                            */}
      {/* ---------------------------------------------------------------- */}
      {[DOOR_FL_PATH, DOOR_FR_PATH, DOOR_RL_PATH, DOOR_RR_PATH].map((d) => (
        <path
          key={d}
          d={d}
          fill="rgba(255,255,255,0.022)"
          stroke="rgba(148,178,184,0.18)"
          strokeWidth={0.8}
          strokeLinejoin="round"
        />
      ))}
      {/* Manetas */}
      <path
        d="M 70 178 h 12 M 158 178 h 12 M 70 226 h 11 M 159 226 h 11"
        stroke="rgba(200,214,218,0.28)"
        strokeWidth={1.6}
        strokeLinecap="round"
        fill="none"
      />
      {/* Retrovisores */}
      <path
        d="M 66 142 L 57 145 L 59 150 L 67 148 Z"
        fill="#162126"
        stroke={MBUX.accentDim}
        strokeWidth={0.7}
      />
      <path
        d="M 174 142 L 183 145 L 181 150 L 173 148 Z"
        fill="#162126"
        stroke={MBUX.accentDim}
        strokeWidth={0.7}
      />

      {/* ---------------------------------------------------------------- */}
      {/* Ruedas                                                            */}
      {/* ---------------------------------------------------------------- */}
      {WHEELS.map((w) => (
        <g key={w.corner}>
          <path
            d={tyrePath(w)}
            fill={`url(#${uid}-tyre)`}
            stroke="rgba(148,178,184,0.22)"
            strokeWidth={0.9}
          />
          {/* Llanta insinuada */}
          <path d={rimPath(w)} fill="none" stroke="rgba(200,214,218,0.16)" strokeWidth={0.9} />
        </g>
      ))}

      {/* ---------------------------------------------------------------- */}
      {/* Capa interactiva: resaltes por estado                             */}
      {/* ---------------------------------------------------------------- */}
      {PART_SHAPES.map((shape) => (
        <PartOverlay
          key={shape.part}
          partId={shape.part}
          d={shape.d}
          severity={severityOf(shape.part)}
          glowFilter={glowFilter}
          onActivate={onPartClick}
        />
      ))}

      {/* ---------------------------------------------------------------- */}
      {/* Etiquetas de rueda (siempre por encima, con fondo opaco)          */}
      {/* ---------------------------------------------------------------- */}
      {WHEELS.map((w) => {
        const text = wheelLabels?.[w.corner];
        if (!text) return null;
        const severity = severityOf(w.part);
        return (
          <WheelBadge
            key={`badge-${w.corner}`}
            x={w.badge.x}
            y={w.badge.y}
            text={text}
            color={severity === "ok" ? MBUX.silver : SEVERITY_COLOR[severity]}
          />
        );
      })}
    </svg>
  );
}
