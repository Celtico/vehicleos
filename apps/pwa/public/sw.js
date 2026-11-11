/**
 * Service worker de VehicleOS.
 *
 * Estrategia:
 *  - Estáticos (/_next/static, /icons, /manifest.json): cache-first.
 *  - API y asistente (/api, http externo) y WebSocket: network-only
 *    (los WebSocket no pasan por fetch; las peticiones de API no se cachean).
 *  - Navegaciones: red con fallback a caché (permite abrir la app offline).
 */
// v2: iconos regenerados en azul; el nombre nuevo invalida la caché antigua.
const STATIC_CACHE = "vehicleos-static-v2";
// Carpeta desde la que se sirve el cockpit, con barra final: "/" en dominio
// propio, "/<repositorio>/cockpit/" en GitHub Pages. Sale del alcance del
// propio service worker, así el fichero vale igual en los dos sitios.
const BASE = new URL(self.registration.scope).pathname;
const PRECACHE = [
  BASE,
  `${BASE}manifest.json`,
  `${BASE}icons/icon-192.png`,
  `${BASE}icons/icon-512.png`,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Solo gestionamos nuestro propio origen; el backend (otro puerto/host)
  // y cualquier API van siempre por red (network-only).
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api")) return;

  const isStatic =
    url.pathname.startsWith(`${BASE}_next/static`) ||
    url.pathname.startsWith(`${BASE}icons/`) ||
    url.pathname === `${BASE}manifest.json`;

  if (isStatic) {
    // Cache-first para estáticos versionados.
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    // Navegación: red primero, caché como fallback offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(BASE))),
    );
  }
});
