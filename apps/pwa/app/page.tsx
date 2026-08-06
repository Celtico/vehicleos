"use client";

/**
 * Dashboard principal: SpeedGauge y RpmGauge centrales, LinearGauges de
 * temperatura/tensión/turbo/combustible, testigos y batería, en tiempo real.
 * Los gauges leen el último valor del store y animan internamente con rAF.
 */
import {
  BatteryIndicator,
  Card,
  LinearGauge,
  MBUX,
  RpmGauge,
  SpeedGauge,
  StatusLight,
  TelemetryTile,
} from "@vehicleos/ui";
import { useVehicleStore } from "../store/vehicle-store";

export default function DashboardPage() {
  const telemetry = useVehicleStore((s) => s.telemetry);

  const t = telemetry;

  return (
    // El cuadro ocupa todo el alto disponible y reparte los tres bloques:
    // en una pantalla de coche no debe quedar espacio muerto bajo las tarjetas.
    <div className="flex h-full min-h-[580px] flex-col justify-between gap-5 p-6">
      {/* Gauges principales */}
      <div className="flex flex-1 flex-wrap items-center justify-center gap-6">
        <SpeedGauge speed={t?.speed ?? 0} size={320} />
        <div className="flex flex-col items-center gap-3">
          <div className="flex flex-row gap-6">
            <StatusLight kind="engine" status={t?.systems.engine ?? "unknown"} />
            <StatusLight kind="abs" status={t?.systems.abs ?? "unknown"} />
            <StatusLight kind="esp" status={t?.systems.esp ?? "unknown"} />
            <StatusLight kind="airbag" status={t?.systems.airbag ?? "unknown"} />
          </div>
          <BatteryIndicator
            voltage={t?.batteryVoltage ?? 12.4}
            engineRunning={t?.engineRunning ?? false}
          />
          <span className="text-[10px] uppercase tracking-[0.25em] text-muted">
            {t?.engineRunning ? "Motor en marcha" : "Motor parado"}
          </span>
        </div>
        <RpmGauge rpm={t?.rpm ?? 0} size={320} />
      </div>

      {/* Barras lineales */}
      <Card>
        <div className="grid grid-cols-2 gap-x-10 gap-y-5 lg:grid-cols-4">
          <LinearGauge
            value={t?.coolantTemp ?? 0}
            min={0}
            max={130}
            label="Refrigerante"
            unit="°C"
            zones={[
              { from: 105, to: 115, color: MBUX.warning },
              { from: 115, to: 130, color: MBUX.danger },
            ]}
          />
          <LinearGauge
            value={t?.batteryVoltage ?? 0}
            min={8}
            max={16}
            label="Tensión"
            unit="V"
            format={(v) => v.toFixed(1)}
            zones={[
              { from: 8, to: 11.8, color: MBUX.danger },
              { from: 11.8, to: 12.8, color: MBUX.warning },
            ]}
          />
          <LinearGauge
            value={t?.turboPressure ?? 0}
            min={0}
            max={2}
            label="Turbo"
            unit="bar"
            format={(v) => v.toFixed(2)}
          />
          <LinearGauge
            value={t?.fuelLevel ?? 0}
            min={0}
            max={100}
            label="Combustible"
            unit="%"
            zones={[{ from: 0, to: 10, color: MBUX.danger }]}
          />
        </div>
      </Card>

      {/* Fila de métricas */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <TelemetryTile label="Consumo" value={t?.fuelRate ?? 0} unit="L/h" decimals={1} />
        <TelemetryTile label="Carga motor" value={t?.engineLoad ?? 0} unit="%" />
        <TelemetryTile label="Acelerador" value={t?.throttle ?? 0} unit="%" />
        <TelemetryTile label="Odómetro" value={t?.odometer ?? 0} unit="km" />
      </div>
    </div>
  );
}
