"use client";

/**
 * Selector de tema en la barra superior.
 *
 * Va aquí y no enterrado en Ajustes porque en un coche es un gesto que se
 * hace sobre la marcha: un día muy nublado pide el tema oscuro aunque sean
 * las cinco de la tarde, y de noche en ciudad iluminada puede apetecer lo
 * contrario.
 *
 * "Auto" es la opción por defecto y devuelve el mando al cálculo solar.
 */
import { useEffect, useState } from "react";
import {
  getThemeMode,
  setThemeMode,
  subscribeThemeMode,
  type ThemeMode,
} from "../lib/theme-mode";

const OPCIONES: { id: ThemeMode; etiqueta: string; icono: React.ReactNode }[] = [
  {
    id: "auto",
    etiqueta: "Automático según el amanecer y el anochecer",
    icono: (
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
        <path d="M12 8a4 4 0 0 0 0 8Z" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    ),
  },
  {
    id: "dia",
    etiqueta: "Tema claro",
    icono: (
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <circle cx="12" cy="12" r="3.6" />
        <path
          d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "noche",
    etiqueta: "Tema oscuro",
    icono: (
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path
          d="M20 14.5A8.2 8.2 0 0 1 9.5 4a8.3 8.3 0 1 0 10.5 10.5Z"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

export function ThemeSwitch() {
  const [modo, setModo] = useState<ThemeMode>("auto");

  // El valor real solo existe en el navegador, así que se lee tras montar
  // para no desalinear el HTML del servidor con el del cliente.
  useEffect(() => {
    setModo(getThemeMode());
    return subscribeThemeMode(setModo);
  }, []);

  return (
    <div
      role="group"
      aria-label="Tema de la pantalla"
      className="flex items-center gap-0.5 rounded-full border border-linea/20 p-0.5"
    >
      {OPCIONES.map((o) => {
        const activa = modo === o.id;
        return (
          <button
            key={o.id}
            type="button"
            title={o.etiqueta}
            aria-label={o.etiqueta}
            aria-pressed={activa}
            onClick={() => setThemeMode(o.id)}
            className={`rounded-full p-1.5 transition-colors ${
              activa ? "bg-accent/15 text-accent" : "text-muted hover:text-silver"
            }`}
          >
            {o.icono}
          </button>
        );
      })}
    </div>
  );
}
