"use client";

/**
 * Mantenimiento: calendario calculado del odómetro con barras de
 * progreso y estados (aceite, filtros, frenos, ITV…).
 *
 * Tres columnas y no dos: son doce partidas y en dos columnas la última
 * fila y media quedaban debajo del corte de la pantalla. Aquí importa menos
 * que en el cuadro —esto se mira con el coche parado— pero una lista de
 * mantenimiento en la que no se ve si algo está vencido sin desplazarse no
 * sirve de mucho.
 */
import { MBUX } from "@vehicleos/ui";
import { maintenanceSchedule, type MaintenanceStatus } from "../../lib/maintenance";
import { useVehicleStore } from "../../store/vehicle-store";

/**
 * Los colores salen del tema y no de un hexadecimal fijo: el verde brillante
 * que funciona sobre negro casi no se lee sobre el fondo claro, y el tema
 * diurno ya trae su propia versión más cargada de cada uno.
 */
const ESTADO: Record<MaintenanceStatus, { label: string; color: string }> = {
  ok: { label: "Al día", color: MBUX.ok },
  soon: { label: "Próximo", color: MBUX.warning },
  due: { label: "Vencido", color: MBUX.danger },
};

export default function MaintenancePage() {
  const odometer = useVehicleStore((s) => s.telemetry?.odometer ?? 0);
  const items = maintenanceSchedule(odometer);
  const km = (v: number) => Math.round(v).toLocaleString("es-ES");

  return (
    <div className="flex h-full flex-col gap-3 px-4 pb-2 pt-1">
      <div className="flex shrink-0 items-baseline justify-between">
        <h1 className="text-xl font-medium tracking-[0.2em] text-silver">MANTENIMIENTO</h1>
        <span className="text-sm text-muted">
          Odómetro: <span className="text-lg font-medium text-silver">{km(odometer)}</span> km
        </span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-3 content-start gap-2.5">
        {items.map((item) => {
          const info = ESTADO[item.status];
          return (
            <div
              key={item.id}
              className="panel-cockpit flex flex-col justify-between gap-2 rounded-2xl px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-silver">
                    {item.name}
                  </span>
                  <span className="block truncate text-[11px] text-muted">{item.detail}</span>
                </span>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]"
                  style={{
                    color: info.color,
                    background: `color-mix(in srgb, ${info.color} 16%, transparent)`,
                  }}
                >
                  {info.label}
                </span>
              </div>

              {/* Barra del intervalo consumido */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-linea/10">
                <div
                  className="h-full rounded-full transition-[width] duration-700"
                  style={{
                    width: `${Math.round(item.progress * 100)}%`,
                    background: info.color,
                  }}
                />
              </div>

              <div className="flex items-baseline justify-between gap-2 text-[10px] text-muted">
                <span className="truncate">Cada {km(item.intervalKm)} km</span>
                <span className="shrink-0 font-semibold" style={{ color: info.color }}>
                  quedan {km(item.remainingKm)} km
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="shrink-0 text-[11px] text-muted">
        Calendario orientativo calculado a partir del odómetro; consulta el plan oficial del
        fabricante para los intervalos exactos y los mantenimientos por tiempo.
      </p>
    </div>
  );
}
