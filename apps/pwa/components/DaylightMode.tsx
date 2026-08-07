"use client";

/**
 * Modo día/noche automático.
 *
 * La tablet no tiene sensor de luz, así que no hay nada que medir: se
 * calcula el orto y el ocaso a partir de la posición GPS del coche y la
 * fecha (ver @vehicleos/shared/sun). Además de ser lo único posible aquí,
 * tiene una ventaja sobre un sensor: no cambia de modo cada vez que el
 * coche pasa bajo un puente o entra en un túnel.
 *
 * Atenúa con una capa oscura por encima de todo en lugar de un filtro CSS
 * sobre el contenedor: un `filter` crea bloque contenedor y rompería el
 * posicionamiento fijo de los avisos.
 */
import { useEffect, useState } from "react";
import { daylightFactor } from "@vehicleos/shared";
import { useVehicleStore } from "../store/vehicle-store";

/** Oscurecimiento máximo en noche cerrada (0 = sin atenuar, 1 = negro). */
const ATENUACION_NOCTURNA = 0.42;

/** Cada cuánto se recalcula. El sol no corre: basta con un minuto. */
const REFRESCO_MS = 60_000;

export function DaylightMode() {
  const location = useVehicleStore((s) => s.telemetry?.location);
  const [luz, setLuz] = useState(1);

  useEffect(() => {
    const recalcular = () => setLuz(daylightFactor(location));
    recalcular();
    const id = setInterval(recalcular, REFRESCO_MS);
    return () => clearInterval(id);
  }, [location]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[60] bg-black transition-opacity duration-1000"
      style={{ opacity: (1 - luz) * ATENUACION_NOCTURNA }}
    />
  );
}
