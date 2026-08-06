"use client";

/**
 * Proveedores globales de la PWA:
 *  - React Query (viajes y otras llamadas al backend).
 *  - Arranque del vehículo: conecta el provider por defecto (simulador)
 *    una única vez en el cliente.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useVehicleStore } from "../store/vehicle-store";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  );

  const boot = useVehicleStore((s) => s.boot);
  const booted = useRef(false);

  useEffect(() => {
    // Arranque del cockpit: restaura los ajustes guardados y conecta
    // (solo en cliente, solo una vez).
    if (booted.current) return;
    booted.current = true;
    void boot();
  }, [boot]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
