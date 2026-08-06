/**
 * Layout de la landing.
 *
 * Las tres tipografías se cargan con next/font/local: se sirven desde el
 * mismo dominio, se precargan y quedan expuestas como variables CSS que usa
 * globals.css. Sus licencias (OFL) están junto a los ficheros en
 * public/fonts.
 */
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const cluster = localFont({
  src: "../public/fonts/BigShoulders-Bold.ttf",
  weight: "700",
  display: "block",
  variable: "--font-cluster",
});

const prose = localFont({
  src: "../public/fonts/BricolageGrotesque-Regular.ttf",
  weight: "400",
  display: "swap",
  variable: "--font-prose",
});

const data = localFont({
  src: "../public/fonts/DMMono-Regular.ttf",
  weight: "400",
  display: "swap",
  variable: "--font-data",
});

export const metadata: Metadata = {
  title: "VehicleOS — El cuadro digital que tu coche no traía de fábrica",
  description:
    "VehicleOS convierte el puerto de diagnóstico OBD-II de un coche antiguo en un cuadro digital con diagnóstico asistido, telemetría y panel de flota. Funciona en pantallas Android, tabletas, móviles y navegadores.",
  openGraph: {
    title: "VehicleOS — El cuadro digital que tu coche no traía de fábrica",
    description:
      "Instrumentación, diagnóstico y telemetría para coches con puerto OBD-II. No te dice P0401: te dice qué rueda.",
    type: "website",
    locale: "es_ES",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#05080a" },
    { media: "(prefers-color-scheme: light)", color: "#ece7dd" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${cluster.variable} ${prose.variable} ${data.variable}`}>
      <body>{children}</body>
    </html>
  );
}
