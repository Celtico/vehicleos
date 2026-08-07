/**
 * Layout raíz del cockpit.
 *
 * La navegación va abajo y no en un rail lateral: en 1280 px de ancho,
 * esos 94 px de barra izquierda son justo lo que necesitan los dos relojes
 * grandes, y abajo los iconos quedan más a mano del conductor.
 */
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Clock } from "../components/Clock";
import { CockpitNotifications } from "../components/CockpitNotifications";
import { DaylightMode } from "../components/DaylightMode";
import { ThemeSwitch } from "../components/ThemeSwitch";
import { ConnectionBadge } from "../components/ConnectionBadge";
import { Providers } from "../components/Providers";
import { ServiceWorkerRegister } from "../components/ServiceWorkerRegister";
import { BottomNav } from "../components/BottomNav";

export const metadata: Metadata = {
  title: "VehicleOS Cockpit",
  description:
    "Cockpit digital del vehículo: instrumentación, diagnóstico, mantenimiento, viajes y asistente",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VehicleOS",
  },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#05080a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Providers>
          {/* Marca el tema día/noche en <html>; no pinta nada. */}
          <DaylightMode />
          <div
            className="flex h-[100dvh] overflow-hidden"
            style={{
              background: "var(--c-fondo-degradado)",
            }}
          >
            <div className="flex min-w-0 flex-1 flex-col">
              {/* Barra superior: identificación del coche y estado. */}
              {/* Tres zonas de ancho igual para que el estado de la conexión
                  quede centrado de verdad y no se mueva cuando el reloj pasa
                  de "9:05" a "12:05". */}
              <header className="grid shrink-0 grid-cols-3 items-center px-4 py-2">
                <span className="truncate text-[15px] font-semibold tracking-[0.01em] text-silver">
                  Mercedes CLK 270 CDI
                  <span className="ml-2 text-[11px] font-normal text-muted">W209 · 2005</span>
                </span>
                <div className="flex justify-center">
                  <ConnectionBadge />
                </div>
                <div className="flex items-center justify-end gap-5">
                  <ThemeSwitch />
                  <Clock />
                </div>
              </header>
              <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
              <BottomNav />
            </div>
            {/* Avisos por encima de todo, visibles en cualquier pantalla. */}
            <CockpitNotifications />
          </div>
          <ServiceWorkerRegister />
        </Providers>
      </body>
    </html>
  );
}
