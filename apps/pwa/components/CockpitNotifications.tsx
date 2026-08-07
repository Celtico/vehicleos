"use client";

/**
 * Avisos del cockpit, visibles en todas las pantallas.
 *
 * Se suscribe a la telemetría del store y evalúa las reglas en
 * lib/cockpit-alerts.ts. La evaluación ocurre aquí y no en el store porque
 * es presentación: el store publica hechos, esta capa decide qué merece
 * interrumpir al conductor.
 *
 * En el cuadro se callan los avisos de avería. Allí el código ya sale en la
 * lista de averías activas, con su explicación, y además se resalta la pieza
 * sobre el coche: el emergente lo decía por tercera vez y encima tapaba el
 * vehículo. Los otros avisos sí se mantienen, porque un número que se pone
 * rojo entre magnitudes es fácil de no ver, y porque llevan una instrucción
 * ("detén el vehículo en cuanto sea seguro") que no está en ninguna parte de
 * la pantalla.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { NotificationStack } from "@vehicleos/ui";
import {
  createAlertState,
  evaluarAvisos,
  type AvisoCockpit,
  type OrigenAviso,
} from "../lib/cockpit-alerts";
import { useVehicleStore } from "../store/vehicle-store";

/** Avisos que sobran en cada pantalla porque ya están a la vista en ella. */
const REDUNDANTES: Record<string, readonly OrigenAviso[]> = {
  "/": ["dtc"],
  "/diagnostics": ["dtc"],
};

export function CockpitNotifications() {
  const telemetry = useVehicleStore((s) => s.telemetry);
  const dtc = useVehicleStore((s) => s.dtc);
  const [avisos, setAvisos] = useState<AvisoCockpit[]>([]);
  const estado = useRef(createAlertState());
  const pathname = usePathname();

  useEffect(() => {
    const nuevos = evaluarAvisos(estado.current, telemetry, dtc);
    if (nuevos.length > 0) {
      // Se conservan los últimos 10: más allá es ruido que nadie leerá.
      setAvisos((previos) => [...previos, ...nuevos].slice(-10));
    }
  }, [telemetry, dtc]);

  // El filtro va al mostrar y no al generar: así, si el conductor cambia de
  // pantalla, el aviso que se calló en el cuadro aparece donde sí hace falta
  // en vez de haberse perdido.
  const visibles = useMemo(() => {
    const callados = REDUNDANTES[pathname];
    if (!callados) return avisos;
    return avisos.filter((a) => !callados.includes(a.origen));
  }, [avisos, pathname]);

  return (
    <NotificationStack
      notifications={visibles}
      onDismiss={(id) => setAvisos((previos) => previos.filter((a) => a.id !== id))}
    />
  );
}
