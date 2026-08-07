import path from "node:path";

/**
 * Configuración de Next.js.
 *
 * transpilePackages incluye todos los paquetes @vehicleos/* por si algún
 * bundler los resuelve desde el código fuente en lugar de dist/.
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Salida autocontenida: Next traza las dependencias que realmente usa y
  // las copia, así la imagen de Docker no arrastra el monorepo entero.
  output: "standalone",
  // El monorepo vive por encima de la app; sin esto el trazado se queda corto.
  outputFileTracingRoot: path.join(process.cwd(), "../../"),
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
