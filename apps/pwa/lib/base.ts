/**
 * Subruta desde la que se sirve el cockpit: vacía en la raíz del dominio,
 * `/<repositorio>/cockpit` en GitHub Pages (ver `next.config.mjs`).
 *
 * Next añade la subruta a sus propios enlaces y a `/_next/…`, pero no a los
 * ficheros de `public/`: esos hay que pedirlos con `conBase()`.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Antepone la subruta a una ruta absoluta de `public/`, p. ej. `/sw.js`. */
export function conBase(ruta: string): string {
  return `${BASE_PATH}${ruta}`;
}
