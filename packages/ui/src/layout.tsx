/**
 * Layouts del cockpit: Screen (pantalla completa negra con degradado
 * ambiental) y Card (panel con borde sutil y glow).
 */
import type { CSSProperties, ReactNode } from "react";
import { MBUX } from "./theme";

export interface ScreenProps {
  children: ReactNode;
  style?: CSSProperties;
}

/** Contenedor de pantalla completa estilo MBUX. */
export function Screen({ children, style }: ScreenProps) {
  return (
    <div
      style={{
        minHeight: "100%",
        background: MBUX.bgGradient,
        color: MBUX.text,
        fontFamily: MBUX.font,
        fontWeight: 300,
        padding: 24,
        boxSizing: "border-box",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export interface CardProps {
  children: ReactNode;
  /** Título superior de la tarjeta. */
  title?: string;
  style?: CSSProperties;
}

/** Panel con degradado sutil, borde plateado y sombra ambiental. */
export function Card({ children, title, style }: CardProps) {
  return (
    <div
      style={{
        background: `${MBUX.panelSheen}, ${MBUX.panel}`,
        border: MBUX.border,
        borderRadius: 16,
        padding: 18,
        boxShadow: MBUX.panelShadow,
        fontFamily: MBUX.font,
        ...style,
      }}
    >
      {title ? (
        <div
          style={{
            fontSize: 11,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: MBUX.muted,
            fontWeight: 300,
            marginBottom: 12,
          }}
        >
          {title}
        </div>
      ) : null}
      {children}
    </div>
  );
}
