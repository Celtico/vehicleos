/**
 * La landing es un sitio estático: `next build` genera HTML plano en `out/`,
 * que se sirve desde cualquier hosting o CDN sin necesidad de Node.
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  reactStrictMode: true,
  // La exportación estática no puede usar el optimizador de imágenes de Next,
  // que necesita servidor. Las capturas ya van comprimidas a mano.
  images: { unoptimized: true },
};

export default nextConfig;
