/**
 * Configuración de Next.js.
 *
 * transpilePackages incluye todos los paquetes @vehicleos/* por si algún
 * bundler los resuelve desde el código fuente en lugar de dist/.
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
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
