/**
 * Modo de tema elegido por el conductor.
 *
 * "auto" deja que mande el cálculo solar; "dia" y "noche" lo fuerzan. Hace
 * falta porque de otro modo no hay manera de ver el tema nocturno hasta que
 * anochece de verdad, ni de forzar el claro un día muy nublado.
 *
 * Se guarda en localStorage y no en el store del vehículo a propósito: es
 * una preferencia de la pantalla, no un dato del coche, y así está
 * disponible antes incluso de que haya telemetría.
 */
export type ThemeMode = "auto" | "dia" | "noche";

const CLAVE = "vehicleos-tema";

type Oyente = (modo: ThemeMode) => void;
const oyentes = new Set<Oyente>();

/** Modo actual. En servidor devuelve "auto", que es el valor seguro. */
export function getThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "auto";
  const v = window.localStorage.getItem(CLAVE);
  return v === "dia" || v === "noche" ? v : "auto";
}

/** Cambia el modo, lo persiste y avisa a quien esté escuchando. */
export function setThemeMode(modo: ThemeMode): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(CLAVE, modo);
  }
  for (const o of oyentes) o(modo);
}

/** Se suscribe a los cambios. Devuelve la función de baja. */
export function subscribeThemeMode(o: Oyente): () => void {
  oyentes.add(o);
  return () => oyentes.delete(o);
}
