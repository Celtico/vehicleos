/**
 * Layout raíz del cockpit: barra lateral de navegación, reloj y estado
 * de conexión, sobre fondo negro con degradado ambiental.
 */
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Clock } from "../components/Clock";
import { ConnectionBadge } from "../components/ConnectionBadge";
import { Providers } from "../components/Providers";
import { ServiceWorkerRegister } from "../components/ServiceWorkerRegister";
import { Sidebar } from "../components/Sidebar";

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
          <div
            className="flex h-screen overflow-hidden"
            style={{
              background:
                "radial-gradient(120% 90% at 30% -10%, #0d181d 0%, #070c0f 45%, #04070a 100%)",
            }}
          >
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              {/* Barra superior: reloj y estado de conexión */}
              <header className="flex items-center justify-between border-b border-white/5 px-6 py-3">
                <span className="text-[11px] uppercase tracking-[0.35em] text-muted">
                  VehicleOS
                </span>
                <div className="flex items-center gap-6">
                  <ConnectionBadge />
                  <Clock />
                </div>
              </header>
              <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
            </div>
          </div>
          <ServiceWorkerRegister />
        </Providers>
      </body>
    </html>
  );
}
