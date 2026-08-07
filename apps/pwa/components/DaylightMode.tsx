"use client";

/**
 * Tema claro de día y oscuro de noche, automático.
 *
 * La tablet no tiene sensor de luz, así que no hay nada que medir: se
 * calcula el orto y el ocaso a partir de la posición GPS del coche y la
 * fecha (ver @vehicleos/shared/sun).
 *
 * Calcularlo, además de ser lo único posible aquí, es mejor que medirlo:
 * un sensor cambiaría de tema cada vez que el coche pasa bajo un puente o
 * entra en un túnel. El orto y el ocaso ocurren dos veces al día.
 *
 * El componente no pinta nada; solo marca `data-tema` en <html>, y de ahí
 * cuelga toda la paleta definida en globals.css.
 */
import { useEffect } from "react";
import { daylightAt, type Daylight } from "@vehicleos/shared";
import { useVehicleStore } from "../store/vehicle-store";
import { getThemeMode, subscribeThemeMode, type ThemeMode } from "../lib/theme-mode";

/** Cada cuánto se recomprueba. El sol no corre: basta con un minuto. */
const REFRESCO_MS = 60_000;

export function DaylightMode() {
  /**
   * Se redondea la posición a ~11 km antes de usarla como dependencia.
   *
   * Sin esto el efecto se reejecutaba con CADA muestra de telemetría, porque
   * las coordenadas cambian constantemente: se recreaba el temporizador sin
   * parar y se pisaba cualquier tema puesto a mano. Para saber si ha
   * amanecido, una décima de grado sobra.
   */
  const zona = useVehicleStore((s) => {
    const l = s.telemetry?.location;
    return l ? `${l.lat.toFixed(1)},${l.lon.toFixed(1)}` : "";
  });

  useEffect(() => {
    const pos = zona
      ? { lat: Number(zona.split(",")[0]), lon: Number(zona.split(",")[1]) }
      : undefined;

    /** El modo manual manda; "auto" delega en el cálculo solar. */
    const aplicar = (modo: ThemeMode = getThemeMode()) => {
      if (modo !== "auto") {
        document.documentElement.dataset.tema = modo;
        return;
      }
      const tema: Daylight = daylightAt(pos);
      document.documentElement.dataset.tema = tema === "day" ? "dia" : "noche";
    };

    aplicar();
    const id = setInterval(() => aplicar(), REFRESCO_MS);
    const baja = subscribeThemeMode(aplicar);
    return () => {
      clearInterval(id);
      baja();
    };
  }, [zona]);

  return null;
}
