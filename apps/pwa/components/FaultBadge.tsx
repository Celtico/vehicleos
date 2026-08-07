"use client";

/**
 * Testigo de averías en la barra superior.
 *
 * Existe porque el cuadro es la única pantalla que enseña las averías: desde
 * el mapa, los viajes o los ajustes no había absolutamente nada que dijera
 * que el coche tiene un código activo. La barra superior está en todas, así
 * que es el sitio.
 *
 * No repite el detalle, que ya vive en la lista del cuadro y en la pantalla
 * de diagnóstico: solo dice cuántas hay y de qué gravedad, y lleva allí al
 * tocarlo. Cuando no hay ninguna no se dibuja nada — la ausencia de aviso ya
 * es el estado bueno, y un "todo correcto" permanente es ruido que se acaba
 * dejando de mirar.
 */
import Link from "next/link";
import { useMemo } from "react";
import { explainDtc } from "@vehicleos/ai";
import { useVehicleStore } from "../store/vehicle-store";

export function FaultBadge() {
  const dtc = useVehicleStore((s) => s.dtc);

  const { total, grave } = useMemo(() => {
    let grave = false;
    for (const d of dtc) {
      const s = explainDtc(d.code).severity;
      if (s === "high" || s === "critical") grave = true;
    }
    return { total: dtc.length, grave };
  }, [dtc]);

  if (total === 0) return null;

  const color = grave ? "text-danger" : "text-warn";

  return (
    <Link
      href="/diagnostics"
      aria-label={`${total} ${total === 1 ? "avería activa" : "averías activas"}. Abrir diagnóstico.`}
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 transition-[filter] hover:brightness-125 ${color}`}
      style={{ background: "color-mix(in srgb, currentColor 14%, transparent)" }}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3.6 2.6 19.8h18.8L12 3.6Z" />
        <path d="M12 10v4.2" strokeLinecap="round" />
        <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
      </svg>
      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] tabular-nums">
        {total} {total === 1 ? "avería" : "averías"}
      </span>
    </Link>
  );
}
