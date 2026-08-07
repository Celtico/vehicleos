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

/** Cada cuánto se recomprueba. El sol no corre: basta con un minuto. */
const REFRESCO_MS = 60_000;

export function DaylightMode() {
  const location = useVehicleStore((s) => s.telemetry?.location);

  useEffect(() => {
    const aplicar = () => {
      const tema: Daylight = daylightAt(location);
      document.documentElement.dataset.tema = tema === "day" ? "dia" : "noche";
    };
    aplicar();
    const id = setInterval(aplicar, REFRESCO_MS);
    return () => clearInterval(id);
  }, [location]);

  return null;
}
