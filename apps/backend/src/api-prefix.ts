/**
 * Prefijo bajo el que se sirve la API.
 *
 * Sirve para desplegar el backend en el mismo dominio que el cockpit, con
 * la API colgando de `/api`. Compartir origen elimina el CORS, que es de lo
 * que más se rompe en un despliegue.
 *
 * Se hace en el servidor y no reescribiendo en el proxy porque las
 * herramientas de proxy con interfaz gráfica (Nginx Proxy Manager, por
 * ejemplo) reenvían la ruta tal cual: quitar el prefijo allí obliga a
 * escribir reglas a mano en cajas de configuración avanzada, que es
 * justo donde se cuelan los errores difíciles de ver.
 */

/** Normaliza el valor de entorno a "" o "/algo" (sin barra final). */
export function apiPrefix(): string {
  const raw = process.env.API_PREFIX?.trim() ?? "";
  if (!raw || raw === "/") return "";
  const conBarra = raw.startsWith("/") ? raw : `/${raw}`;
  return conBarra.endsWith("/") ? conBarra.slice(0, -1) : conBarra;
}

/**
 * Ruta del punto de entrada de socket.io, alineada con el prefijo.
 *
 * El cliente debe usar exactamente esta misma ruta
 * (`NEXT_PUBLIC_SOCKET_PATH` en la PWA).
 */
export function socketIoPath(): string {
  return `${apiPrefix()}/socket.io`;
}
