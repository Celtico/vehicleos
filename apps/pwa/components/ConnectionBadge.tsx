"use client";

/**
 * Estado de la conexión con el vehículo (punto de color + etiqueta).
 */
import { useVehicleStore } from "../store/vehicle-store";

const LABELS: Record<string, { text: string; color: string }> = {
  connected: { text: "Conectado", color: "#38e07d" },
  connecting: { text: "Conectando…", color: "#ffb020" },
  disconnected: { text: "Desconectado", color: "#7f9299" },
  error: { text: "Error", color: "#ff4d5a" },
};

export function ConnectionBadge() {
  const connection = useVehicleStore((s) => s.connection);
  const kind = useVehicleStore((s) => s.kind);
  const info = LABELS[connection] ?? LABELS.disconnected!;

  return (
    <div className="flex items-center gap-2" title={`Provider: ${kind}`}>
      <span
        className="h-2 w-2 rounded-full"
        style={{
          background: info.color,
          boxShadow: connection === "connected" ? `0 0 6px ${info.color}` : "none",
        }}
      />
      <span className="text-[10px] uppercase tracking-[0.2em] text-muted">{info.text}</span>
    </div>
  );
}
