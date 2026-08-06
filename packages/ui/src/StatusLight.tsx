/**
 * StatusLight — testigo del cuadro (motor, ABS, ESP, airbag).
 *
 * Estados: ok (apagado/sutil), warning (ámbar), error (rojo con pulso SMIL),
 * unknown (gris punteado). Iconos SVG inline sin dependencias.
 */
import type { SystemHealth } from "@vehicleos/shared";
import { MBUX } from "./theme";

export type StatusLightKind = "engine" | "abs" | "esp" | "airbag";

export interface StatusLightProps {
  kind: StatusLightKind;
  status: SystemHealth;
  /** Etiqueta bajo el icono; por defecto según el tipo. */
  label?: string;
  size?: number;
}

const DEFAULT_LABELS: Record<StatusLightKind, string> = {
  engine: "Motor",
  abs: "ABS",
  esp: "ESP",
  airbag: "Airbag",
};

function statusColor(status: SystemHealth): string {
  switch (status) {
    case "ok":
      return "#42545b";
    case "warning":
      return MBUX.warning;
    case "error":
      return MBUX.danger;
    case "unknown":
      return "#5a6a70";
  }
}

/** Icono del testigo, dibujado con trazos SVG (viewBox 0 0 32 32). */
function Icon({ kind, color }: { kind: StatusLightKind; color: string }) {
  const stroke = {
    stroke: color,
    fill: "none",
    strokeWidth: 1.8,
    strokeLinejoin: "round" as const,
  };
  switch (kind) {
    case "engine":
      // Silueta clásica de "check engine".
      return (
        <g {...stroke} strokeLinecap="round">
          <path d="M9 12 h3 v-2.5 h6 l2.5 2.5 H24 v3 h2.5 v6 H24 v2 h-5 l-2 2 h-5 v-3 H9.5 v2 H6.5 v-9 H9 z" />
          <line x1="12.5" y1="7" x2="15" y2="9.5" />
        </g>
      );
    case "abs":
      return (
        <g {...stroke}>
          <circle cx="16" cy="16" r="7.5" />
          <path d="M5.5 9 a13 13 0 0 0 0 14" />
          <path d="M26.5 9 a13 13 0 0 1 0 14" />
          <text
            x="16"
            y="16.8"
            fill={color}
            stroke="none"
            fontSize="6.4"
            fontWeight={600}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            ABS
          </text>
        </g>
      );
    case "esp":
      // Coche con huellas de derrape.
      return (
        <g {...stroke} strokeLinecap="round">
          <path d="M10 13 h12 l2.5 4 v4 h-17 v-4 z" />
          <circle cx="12.5" cy="21.5" r="1.6" />
          <circle cx="19.5" cy="21.5" r="1.6" />
          <path d="M6 25.5 q2 -1.4 4 0 t4 0" />
          <path d="M18 25.5 q2 -1.4 4 0 t4 0" />
        </g>
      );
    case "airbag":
      // Ocupante con bolsa desplegada.
      return (
        <g {...stroke} strokeLinecap="round">
          <circle cx="10.5" cy="9.5" r="2.6" />
          <path d="M8 13.5 v7 l3 4 h4" />
          <path d="M8 17.5 h5" />
          <circle cx="21" cy="17" r="6" strokeDasharray="2.6 2" />
        </g>
      );
  }
}

export function StatusLight({ kind, status, label, size = 62 }: StatusLightProps) {
  const color = statusColor(status);
  const active = status === "warning" || status === "error";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        fontFamily: MBUX.font,
      }}
      title={`${DEFAULT_LABELS[kind]}: ${status}`}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        role="img"
        aria-label={`${DEFAULT_LABELS[kind]} ${status}`}
      >
        {/* Halo cuando el testigo está encendido */}
        {active ? (
          <circle cx="16" cy="16" r="14" fill={color} opacity={0.12}>
            {status === "error" ? (
              <animate
                attributeName="opacity"
                values="0.2;0.06;0.2"
                dur="1.1s"
                repeatCount="indefinite"
              />
            ) : null}
          </circle>
        ) : null}
        <g opacity={status === "unknown" ? 0.55 : 1}>
          <Icon kind={kind} color={color} />
          {status === "error" ? (
            <animate
              attributeName="opacity"
              values="1;0.45;1"
              dur="1.1s"
              repeatCount="indefinite"
            />
          ) : null}
        </g>
      </svg>
      <span
        style={{
          fontSize: 10,
          letterSpacing: 2,
          textTransform: "uppercase",
          fontWeight: 300,
          color: active ? color : MBUX.muted,
        }}
      >
        {label ?? DEFAULT_LABELS[kind]}
      </span>
    </div>
  );
}
