"use client";

/**
 * Diagnóstico: lista de DTC del provider con la explicación local de
 * @vehicleos/ai (causa probable con probabilidad, causas, soluciones y
 * cuánto se puede circular), y botón para borrar códigos.
 */
import { useState } from "react";
import { explainDtc } from "@vehicleos/ai";
import { Card } from "@vehicleos/ui";
import { useVehicleStore } from "../../store/vehicle-store";

const SEVERITY_STYLE: Record<string, { label: string; className: string }> = {
  low: { label: "Leve", className: "bg-okgreen/15 text-okgreen" },
  medium: { label: "Moderada", className: "bg-warn/15 text-warn" },
  high: { label: "Grave", className: "bg-danger/15 text-danger" },
  critical: { label: "Crítica", className: "bg-danger/25 text-danger" },
};

const STATUS_LABEL: Record<string, string> = {
  stored: "Confirmado",
  pending: "Pendiente",
  permanent: "Permanente",
};

export default function DiagnosticsPage() {
  const dtc = useVehicleStore((s) => s.dtc);
  const clearDtc = useVehicleStore((s) => s.clearDtc);
  const [clearing, setClearing] = useState(false);

  const handleClear = async () => {
    setClearing(true);
    try {
      await clearDtc();
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-medium tracking-[0.2em] text-silver">DIAGNÓSTICO</h1>
        <button
          onClick={handleClear}
          disabled={clearing || dtc.length === 0}
          className="rounded-lg border border-accent/40 px-4 py-2 text-xs uppercase tracking-widest text-accent transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-30"
        >
          {clearing ? "Borrando…" : "Borrar códigos"}
        </button>
      </div>

      {dtc.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 py-10">
            <svg viewBox="0 0 48 48" className="h-14 w-14 text-okgreen">
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M15 24.5 l6.5 6.5 L33 18.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="text-lg font-medium text-silver">Sin averías activas</p>
            <p className="text-sm text-muted">
              No hay códigos de diagnóstico almacenados en el vehículo.
            </p>
          </div>
        </Card>
      ) : (
        dtc.map((d) => {
          const e = explainDtc(d.code);
          const sev = SEVERITY_STYLE[e.severity] ?? SEVERITY_STYLE.medium!;
          return (
            <Card key={`${d.code}-${d.status}`}>
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-2xl font-light text-accent">{d.code}</span>
                  <span className="text-lg font-medium text-silver">{e.title}</span>
                  <span
                    className={`rounded-full px-3 py-0.5 text-[10px] uppercase tracking-widest ${sev.className}`}
                  >
                    {sev.label}
                  </span>
                  <span className="rounded-full bg-linea/5 px-3 py-0.5 text-[10px] uppercase tracking-widest text-muted">
                    {STATUS_LABEL[d.status] ?? d.status}
                  </span>
                  {e.generic ? (
                    <span className="rounded-full bg-linea/5 px-3 py-0.5 text-[10px] uppercase tracking-widest text-muted">
                      Explicación genérica
                    </span>
                  ) : null}
                </div>

                <div className="rounded-xl border border-accent/20 bg-accent/5 px-4 py-3">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-muted">
                    Causa probable · {e.probability}%
                  </span>
                  <p className="mt-1 text-sm text-silver">{e.probableCause}</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-muted">
                      Causas (de más a menos probable)
                    </span>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-silver/90">
                      {e.causes.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ol>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-muted">
                      Soluciones posibles
                    </span>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-silver/90">
                      {e.solutions.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="rounded-xl border border-linea/10 bg-linea/[0.03] px-4 py-3">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-muted">
                    ¿Puedo seguir conduciendo?
                  </span>
                  <p className="mt-1 text-sm text-silver">{e.canDrive}</p>
                </div>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
