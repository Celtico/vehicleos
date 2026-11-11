/**
 * La landing es un sitio estático: `next build` genera HTML plano en `out/`,
 * que se sirve desde cualquier hosting o CDN sin necesidad de Node.
 *
 * `BASE_PATH` es la subruta desde la que se sirve cuando no ocupa la raíz
 * del dominio (en GitHub Pages, `/<repositorio>`). Vacía en dominio propio.
 */
const basePath = (process.env.BASE_PATH ?? "").replace(/\/+$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  reactStrictMode: true,
  ...(basePath ? { basePath } : {}),
  // next/image y los enlaces a ficheros de `public/` no añaden la subruta
  // por su cuenta: el código la lee de aquí.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  // La exportación estática no puede usar el optimizador de imágenes de Next,
  // que necesita servidor. Las capturas ya van comprimidas a mano.
  images: { unoptimized: true },
};

export default nextConfig;
