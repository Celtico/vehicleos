"use client";

/**
 * Mantenimiento: calendario calculado del odómetro con barras de
 * progreso y estados (aceite, filtros, frenos, ITV…).
 */
import { Card } from "@vehicleos/ui";
import { maintenanceSchedule, type MaintenanceStatus } from "../../lib/maintenance";
import { useVehicleStore } from "../../store/vehicle-store";

const STATUS_INFO: Record<MaintenanceStatus, { label: string; color: string }> = {
  ok: { label: "Al día", color: "#38e07d" },
  soon: { label: "Próximo", color: "#ffb020" },
  due: { label: "Vencido", color: "#ff4d5a" },
};

export default function MaintenancePage() {
  const odometer = useVehicleStore((s) => s.telemetry?.odometer ?? 0);
  const items = maintenanceSchedule(odometer);

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-thin tracking-[0.2em] text-silver">MANTENIMIENTO</h1>
        <span className="text-sm text-muted">
          Odómetro:{" "}
          <span className="text-lg font-thin text-silver">
            {Math.round(odometer).toLocaleString("es-ES")}
          </span>{" "}
          km
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((item) => {
          const info = STATUS_INFO[item.status];
          return (
            <Card key={item.id}>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-light text-silver">{item.name}</p>
                    <p className="text-xs text-muted">{item.detail}</p>
                  </div>
                  <span
                    className="rounded-full px-3 py-1 text-[10px] uppercase tracking-widest"
                    style={{ color: info.color, background: `${info.color}20` }}
                  >
                    {info.label}
                  </span>
                </div>

                {/* Barra de progreso del intervalo */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.round(item.progress * 100)}%`,
                      background: info.color,
                      boxShadow: `0 0 8px ${info.color}80`,
                    }}
                  />
                </div>

                <div className="flex justify-between text-xs text-muted">
                  <span>Cada {item.intervalKm.toLocaleString("es-ES")} km</span>
                  <span>
                    Próximo a los {item.dueKm.toLocaleString("es-ES")} km ·{" "}
                    <span style={{ color: info.color }}>
                      quedan {Math.round(item.remainingKm).toLocaleString("es-ES")} km
                    </span>
                  </span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted">
        Calendario orientativo calculado a partir del odómetro; consulta el plan oficial del
        fabricante para los intervalos exactos y los mantenimientos por tiempo.
      </p>
    </div>
  );
}
