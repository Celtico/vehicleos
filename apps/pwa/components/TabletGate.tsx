"use client";

/**
 * Portero de tamaño de pantalla: el cockpit está pensado para la pantalla
 * del coche o una tablet apaisada, y en un móvil (menos de 640 px de ancho)
 * los relojes no caben ni reordenándolos. En vez de cargar el cuadro roto,
 * se muestra un cartel pidiendo entrar desde una tablet.
 *
 * El corte es por ancho de viewport y reactivo: si el usuario rota el
 * dispositivo o redimensiona la ventana, el cockpit aparece o desaparece al
 * momento. En servidor se asume pantalla grande (el HTML de la primera
 * pintura es el cockpit; en un móvil se sustituye al hidratar).
 */
import { useSyncExternalStore } from "react";

const CONSULTA = "(max-width: 639px)";

function suscribir(cb: () => void): () => void {
  const mq = window.matchMedia(CONSULTA);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function esMovil(): boolean {
  return window.matchMedia(CONSULTA).matches;
}

export function TabletGate({ children }: { children: React.ReactNode }) {
  const movil = useSyncExternalStore(suscribir, esMovil, () => false);

  if (!movil) return <>{children}</>;

  return (
    <div
      className="flex h-[100dvh] flex-col items-center justify-center gap-5 px-8 text-center"
      style={{ background: "var(--c-fondo-degradado)" }}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-16 w-16 text-accent"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Tablet apaisada */}
        <rect x="2" y="5" width="20" height="14" rx="2.5" />
        <path d="M19 12h.01" />
      </svg>
      <h1 className="text-xl font-semibold tracking-[0.06em] text-silver">
        Entra desde una tablet
      </h1>
      <p className="max-w-sm text-sm leading-relaxed text-muted">
        VehicleOS es el cuadro de instrumentos del coche: está diseñado para la pantalla del
        vehículo o una tablet en horizontal, y en esta pantalla no cabe.
      </p>
    </div>
  );
}
