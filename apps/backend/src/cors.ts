/**
 * Origen(es) permitidos por CORS, configurables por entorno.
 *
 * `CORS_ORIGIN` acepta una lista separada por comas, o `*` para permitir
 * cualquier origen (útil solo en desarrollo: con `*` no pueden viajar
 * credenciales). Por defecto, la PWA en local.
 */
const DEFAULT_ORIGIN = "http://localhost:3000";

/** Valor de `origin` para `enableCors` y para el gateway de socket.io. */
export function corsOrigin(): string | string[] | boolean {
  const raw = process.env.CORS_ORIGIN?.trim();
  if (!raw) return DEFAULT_ORIGIN;
  if (raw === "*") return true;
  const origins = raw
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
  return origins.length === 1 ? (origins[0] as string) : origins;
}

/** Con `*` no se pueden enviar credenciales (lo prohíbe la especificación). */
export function corsCredentials(): boolean {
  return process.env.CORS_ORIGIN?.trim() !== "*";
}
