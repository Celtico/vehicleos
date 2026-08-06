"use client";

/**
 * Avisos del cockpit, visibles en todas las pantallas.
 *
 * Se suscribe a la telemetría del store y evalúa las reglas en
 * lib/cockpit-alerts.ts. La evaluación ocurre aquí y no en el store porque
 * es presentación: el store publica hechos, esta capa decide qué merece
 * interrumpir al conductor.
 */
import { useEffect, useRef, useState } from "react";
import { NotificationStack, type CockpitNotification } from "@vehicleos/ui";
import { createAlertState, evaluarAvisos } from "../lib/cockpit-alerts";
import { useVehicleStore } from "../store/vehicle-store";

export function CockpitNotifications() {
  const telemetry = useVehicleStore((s) => s.telemetry);
  const dtc = useVehicleStore((s) => s.dtc);
  const [avisos, setAvisos] = useState<CockpitNotification[]>([]);
  const estado = useRef(createAlertState());

  useEffect(() => {
    const nuevos = evaluarAvisos(estado.current, telemetry, dtc);
    if (nuevos.length > 0) {
      // Se conservan los últimos 10: más allá es ruido que nadie leerá.
      setAvisos((previos) => [...previos, ...nuevos].slice(-10));
    }
  }, [telemetry, dtc]);

  return (
    <NotificationStack
      notifications={avisos}
      onDismiss={(id) => setAvisos((previos) => previos.filter((a) => a.id !== id))}
    />
  );
}
