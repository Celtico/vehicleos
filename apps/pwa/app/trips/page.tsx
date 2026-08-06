"use client";

/**
 * Viajes: lista desde el backend vía React Query
 * (GET ${API}/vehicles/:id/trips) con fallback a datos locales si el
 * backend no responde.
 */
import { useQuery } from "@tanstack/react-query";
import type { Trip } from "@vehicleos/shared";
import { Card } from "@vehicleos/ui";
import { LOCAL_TRIPS } from "../../lib/local-trips";
import { useVehicleStore } from "../../store/vehicle-store";

/**
 * Viajes reales del backend. Requiere el token y el id de vehículo
 * configurados en Ajustes: cada coche pertenece a un usuario, así que sin
 * credenciales el backend responde 401 y la pantalla cae a datos locales.
 */
async function fetchTrips(apiUrl: string, vehicleId: string, token: string): Promise<Trip[]> {
  if (!token) throw new Error("Sin token de acceso configurado");
  const res = await fetch(`${apiUrl}/vehicles/${vehicleId}/trips`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Backend respondió ${res.status}`);
  return (await res.json()) as Trip[];
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function duration(trip: Trip): string {
  if (!trip.endedAt) return "en curso";
  const min = Math.round((trip.endedAt - trip.startedAt) / 60000);
  return min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`;
}

export default function TripsPage() {
  const apiUrl = useVehicleStore((s) => s.apiUrl);
  const vehicleId = useVehicleStore((s) => s.vehicleId);
  const authToken = useVehicleStore((s) => s.authToken);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["trips", apiUrl, vehicleId, authToken],
    queryFn: () => fetchTrips(apiUrl, vehicleId, authToken),
    retry: 1,
  });

  const trips = data ?? (isError ? LOCAL_TRIPS : []);

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-thin tracking-[0.2em] text-silver">VIAJES</h1>
        {isError ? (
          <span className="rounded-full bg-warn/15 px-3 py-1 text-[10px] uppercase tracking-widest text-warn">
            Backend no disponible · datos locales
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <Card>
          <p className="py-8 text-center text-sm text-muted">Cargando viajes…</p>
        </Card>
      ) : trips.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-muted">Aún no hay viajes registrados.</p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {trips.map((trip) => (
            <Card key={trip.id}>
              <div className="flex flex-col gap-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-silver">{formatDate(trip.startedAt)}</span>
                  <span className="text-xs text-muted">{duration(trip)}</span>
                </div>
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div>
                    <p className="text-2xl font-thin text-accent">
                      {trip.distanceKm.toFixed(1)}
                    </p>
                    <p className="text-[10px] uppercase tracking-widest text-muted">km</p>
                  </div>
                  <div>
                    <p className="text-2xl font-thin text-silver">
                      {trip.avgConsumption.toFixed(1)}
                    </p>
                    <p className="text-[10px] uppercase tracking-widest text-muted">L/100km</p>
                  </div>
                  <div>
                    <p className="text-2xl font-thin text-silver">
                      {Math.round(trip.avgSpeed)}
                    </p>
                    <p className="text-[10px] uppercase tracking-widest text-muted">
                      km/h media
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-thin text-silver">
                      {Math.round(trip.maxSpeed)}
                    </p>
                    <p className="text-[10px] uppercase tracking-widest text-muted">km/h máx</p>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
