"use client";

/**
 * Panel web de la flota.
 *
 * Es la vista de "dueño de varios coches", no la de conductor: todos los
 * vehículos del usuario, dónde están, cómo están, su historial, sus alertas
 * y sus estadísticas. Consume los endpoints del backend con el JWT que se
 * configura en Ajustes.
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card } from "@vehicleos/ui";
import type { VehicleAlert } from "@vehicleos/shared";
import { api, ApiError, type VehicleStatus } from "../../lib/api";
import { FleetMap, type FleetMapPoint } from "../../components/FleetMap";
import { useVehicleStore } from "../../store/vehicle-store";

/** Refresco de los datos del panel: 10 s es suficiente para una flota. */
const REFRESCO_MS = 10_000;

/** Gravedad de un coche a partir de sus averías y alertas sin reconocer. */
function gravedad(status: VehicleStatus | undefined): "ok" | "warning" | "critical" {
  if (!status) return "ok";
  if (status.pendingAlerts.some((a) => a.severity === "critical")) return "critical";
  if (status.activeDtc.length > 0 || status.pendingAlerts.length > 0) return "warning";
  return "ok";
}

function fecha(ts: number): string {
  return new Date(ts).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PanelPage() {
  const apiUrl = useVehicleStore((s) => s.apiUrl);
  const token = useVehicleStore((s) => s.authToken);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const vehiculos = useQuery({
    queryKey: ["panel-vehicles", apiUrl, token],
    queryFn: () => api.vehicles(apiUrl, token),
    refetchInterval: REFRESCO_MS,
    retry: 1,
    enabled: token.length > 0,
  });

  const alertas = useQuery({
    queryKey: ["panel-alerts", apiUrl, token],
    queryFn: () => api.alerts(apiUrl, token),
    refetchInterval: REFRESCO_MS,
    retry: 1,
    enabled: token.length > 0,
  });

  // Un estado por vehículo. Se lanzan en paralelo y se refrescan juntos.
  const estados = useQuery({
    queryKey: ["panel-status", apiUrl, token, vehiculos.data?.map((v) => v.id).join(",")],
    queryFn: async () => {
      const lista = vehiculos.data ?? [];
      const resultados = await Promise.all(
        lista.map((v) => api.status(apiUrl, token, v.id).catch(() => null)),
      );
      const mapa: Record<string, VehicleStatus> = {};
      resultados.forEach((r) => {
        if (r) mapa[r.vehicleId] = r;
      });
      return mapa;
    },
    enabled: (vehiculos.data?.length ?? 0) > 0,
    refetchInterval: REFRESCO_MS,
  });

  const stats = useQuery({
    queryKey: ["panel-stats", apiUrl, token, seleccionado],
    queryFn: () => api.stats(apiUrl, token, seleccionado as string),
    enabled: Boolean(seleccionado) && token.length > 0,
  });

  const viajes = useQuery({
    queryKey: ["panel-trips", apiUrl, token, seleccionado],
    queryFn: () => api.trips(apiUrl, token, seleccionado as string),
    enabled: Boolean(seleccionado) && token.length > 0,
  });

  const reconocer = useMutation({
    mutationFn: (id: string) => api.ackAlert(apiUrl, token, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["panel-alerts"] });
      void queryClient.invalidateQueries({ queryKey: ["panel-status"] });
    },
  });

  const puntos: FleetMapPoint[] = useMemo(() => {
    const lista = vehiculos.data ?? [];
    const mapa = estados.data ?? {};
    return lista
      .map((v): FleetMapPoint | null => {
        const loc = mapa[v.id]?.lastSample?.location;
        if (!loc) return null;
        return {
          vehicleId: v.id,
          name: v.name,
          location: loc,
          severity: gravedad(mapa[v.id]),
          selected: v.id === seleccionado,
        };
      })
      .filter((p): p is FleetMapPoint => p !== null);
  }, [vehiculos.data, estados.data, seleccionado]);

  // ── Estados de error / sin configurar ───────────────────────
  if (!token) {
    return (
      <div className="flex h-full flex-col px-4 pt-1">
        <h1 className="mb-4 shrink-0 text-xl font-medium uppercase tracking-[0.2em] text-silver">
          Flota
        </h1>
        <Card style={{ margin: "auto", maxWidth: 520, textAlign: "center" }}>
          <p className="text-sm text-silver">Falta el token de acceso.</p>
          <p className="mt-1 text-xs text-muted">
            El panel muestra los coches de tu cuenta, así que necesita autenticarse. Configura
            el token en Ajustes → Backend y telemetría.
          </p>
        </Card>
      </div>
    );
  }

  if (vehiculos.isError) {
    const err = vehiculos.error;
    return (
      <div className="flex h-full flex-col px-4 pt-1">
        <h1 className="mb-4 shrink-0 text-xl font-medium uppercase tracking-[0.2em] text-silver">
          Flota
        </h1>
        <Card style={{ margin: "auto", maxWidth: 520, textAlign: "center" }}>
          <p className="text-sm text-danger">No se pudo hablar con el backend.</p>
          <p className="mt-1 text-xs text-muted">
            {err instanceof ApiError ? err.message : String(err)}
          </p>
        </Card>
      </div>
    );
  }

  const lista = vehiculos.data ?? [];
  const mapaEstados = estados.data ?? {};
  const sinReconocer = (alertas.data ?? []).filter((a) => !a.acknowledged);

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-medium uppercase tracking-[0.2em] text-silver">Flota</h1>
        <span className="text-[10px] uppercase tracking-[0.25em] text-muted">
          {lista.length} {lista.length === 1 ? "vehículo" : "vehículos"} · {sinReconocer.length}{" "}
          {sinReconocer.length === 1 ? "alerta" : "alertas"}
        </span>
      </div>

      {/* Mapa de toda la flota */}
      <Card title="Ubicación">
        <FleetMap points={puntos} onSelect={setSeleccionado} />
      </Card>

      {/* Tarjetas de estado por vehículo */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {lista.map((v) => {
          const st = mapaEstados[v.id];
          const g = gravedad(st);
          const borde =
            g === "critical"
              ? "border-danger/50"
              : g === "warning"
                ? "border-warning/40"
                : "border-linea/10";
          return (
            <button
              key={v.id}
              onClick={() => setSeleccionado(v.id === seleccionado ? null : v.id)}
              className={`rounded-2xl border ${borde} bg-linea/[0.03] p-4 text-left transition-colors hover:border-accent/40 ${
                v.id === seleccionado ? "ring-1 ring-accent/40" : ""
              }`}
            >
              <div className="flex items-baseline justify-between">
                <p className="text-sm text-silver">{v.name}</p>
                <span className="text-[10px] uppercase tracking-wider text-muted">
                  {v.make} {v.model} · {v.year}
                </span>
              </div>

              {st?.lastSample ? (
                <>
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    <Metric valor={st.lastSample.speed} unidad="km/h" />
                    <Metric valor={st.lastSample.coolantTemp} unidad="°C" />
                    <Metric valor={st.lastSample.batteryVoltage} unidad="V" decimales={1} />
                    <Metric valor={st.lastSample.fuelLevel} unidad="%" />
                  </div>
                  <p className="mt-2 text-[10px] uppercase tracking-wider text-muted">
                    Última señal: {fecha(st.lastSample.timestamp)}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-xs text-muted">Sin telemetría recibida.</p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {st && st.activeDtc.length > 0 ? (
                  st.activeDtc.slice(0, 4).map((d) => (
                    <span
                      key={d.code}
                      className="rounded-md bg-danger/15 px-2 py-0.5 font-mono text-[11px] text-danger"
                    >
                      {d.code}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-ok">Sin averías activas</span>
                )}
              </div>
            </button>
          );
        })}

        {lista.length === 0 && !vehiculos.isLoading ? (
          <Card>
            <p className="text-sm text-silver">No hay vehículos en esta cuenta.</p>
            <p className="mt-1 text-xs text-muted">
              Crea uno con POST /vehicles y aparecerá aquí.
            </p>
          </Card>
        ) : null}
      </div>

      {/* Estadísticas e historial del vehículo seleccionado */}
      {seleccionado ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Estadísticas">
            {stats.data ? (
              <div className="grid grid-cols-2 gap-4">
                <Dato etiqueta="Distancia" valor={`${stats.data.distanceKm.toFixed(1)} km`} />
                <Dato etiqueta="Muestras" valor={String(stats.data.sampleCount)} />
                <Dato etiqueta="Vel. media" valor={`${stats.data.avgSpeed.toFixed(1)} km/h`} />
                <Dato etiqueta="Vel. máxima" valor={`${stats.data.maxSpeed.toFixed(1)} km/h`} />
                <Dato
                  etiqueta="Consumo medio"
                  valor={
                    stats.data.avgConsumption > 0
                      ? `${stats.data.avgConsumption.toFixed(1)} L/100km`
                      : "—"
                  }
                />
              </div>
            ) : (
              <p className="text-xs text-muted">Cargando…</p>
            )}
          </Card>

          <Card title="Historial de viajes">
            {viajes.data && viajes.data.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {viajes.data.slice(0, 6).map((t) => (
                  <li
                    key={t.id}
                    className="flex items-baseline justify-between border-b border-linea/5 pb-1.5 text-xs last:border-0"
                  >
                    <span className="text-muted">{fecha(t.startedAt)}</span>
                    <span className="text-silver">
                      {t.distanceKm.toFixed(1)} km · {t.avgSpeed.toFixed(0)} km/h medios
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted">Sin viajes registrados.</p>
            )}
          </Card>
        </div>
      ) : null}

      {/* Alertas de toda la flota */}
      <Card title="Alertas">
        {sinReconocer.length === 0 ? (
          <p className="text-xs text-muted">No hay alertas pendientes.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sinReconocer.map((a: VehicleAlert) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-linea/5 bg-linea/[0.02] px-3 py-2"
              >
                <div className="min-w-0">
                  <p
                    className={`text-xs ${
                      a.severity === "critical"
                        ? "text-danger"
                        : a.severity === "warning"
                          ? "text-warning"
                          : "text-silver"
                    }`}
                  >
                    {a.message}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-muted">
                    {fecha(a.createdAt)} · {a.kind}
                  </p>
                </div>
                <button
                  onClick={() => reconocer.mutate(a.id)}
                  disabled={reconocer.isPending}
                  className="shrink-0 rounded-lg border border-linea/10 px-3 py-1 text-[10px] uppercase tracking-widest text-muted transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-40"
                >
                  Reconocer
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Metric({
  valor,
  unidad,
  decimales = 0,
}: {
  valor: number;
  unidad: string;
  decimales?: number;
}) {
  return (
    <div>
      <p className="text-lg font-light text-silver">{valor.toFixed(decimales)}</p>
      <p className="text-[9px] uppercase tracking-wider text-muted">{unidad}</p>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted">{etiqueta}</p>
      <p className="mt-0.5 text-lg font-light text-silver">{valor}</p>
    </div>
  );
}
