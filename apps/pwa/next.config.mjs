import path from "node:path";

/**
 * Configuración de Next.js.
 *
 * transpilePackages incluye todos los paquetes @vehicleos/* por si algún
 * bundler los resuelve desde el código fuente en lugar de dist/.
 *
 * Dos variables cambian el tipo de build, ambas pensadas para publicar el
 * cockpit como sitio estático (GitHub Pages), donde solo funciona con el
 * simulador porque no hay backend:
 *  - `STATIC_EXPORT=1`: `next build` escribe HTML plano en `out/` en lugar
 *    del servidor autocontenido que usa la imagen de Docker.
 *  - `BASE_PATH`: subruta desde la que se sirve (`/<repositorio>/cockpit`).
 */
const staticExport = process.env.STATIC_EXPORT === "1";
const basePath = (process.env.BASE_PATH ?? "").replace(/\/+$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(staticExport
    ? { output: "export" }
    : {
        // Salida autocontenida: Next traza las dependencias que realmente usa y
        // las copia, así la imagen de Docker no arrastra el monorepo entero.
        output: "standalone",
        // El monorepo vive por encima de la app; sin esto el trazado se queda corto.
        outputFileTracingRoot: path.join(process.cwd(), "../../"),
      }),
  ...(basePath ? { basePath } : {}),
  // Los ficheros de `public/` (manifest, iconos, modelo 3D, service worker)
  // no reciben la subruta automáticamente: `lib/base.ts` la lee de aquí.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  reactStrictMode: true,
  transpilePackages: [
    "@vehicleos/shared",
    "@vehicleos/ui",
    "@vehicleos/storage",
    "@vehicleos/telemetry",
    "@vehicleos/ai",
    "@vehicleos/vehicle-sdk",
    "@vehicleos/vehicle-simulator",
    "@vehicleos/vehicle-protocol",
  ],
};

export default nextConfig;
