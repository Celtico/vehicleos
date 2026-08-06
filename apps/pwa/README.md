# @vehicleos/pwa

Cockpit **PWA** de VehicleOS: Next.js 14 (App Router) + Tailwind + Zustand + React Query. Diseño tipo Mercedes MBUX moderno (negro, cian-turquesa, tipografía fina), instalable (manifest `standalone` + `landscape` + service worker propio).

## Pantallas

| Ruta           | Contenido                                                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/`            | Dashboard: SpeedGauge y RpmGauge centrales, LinearGauges (temperatura, tensión, turbo, combustible), testigos motor/ABS/ESP/airbag, batería y métricas |
| `/diagnostics` | DTC del provider con explicación de `@vehicleos/ai` (causa probable con %, causas, soluciones, cuánto puedes conducir) y borrado de códigos            |
| `/maintenance` | Calendario de mantenimiento calculado del odómetro con barras de progreso                                                                              |
| `/trips`       | Viajes desde el backend (React Query, `GET ${API}/vehicles/:id/trips`) con fallback local                                                              |
| `/map`         | Mapa propio sin servicios externos: polyline SVG autoescalada de la ruta GPS en vivo, con posición y rumbo                                             |
| `/settings`    | Provider (Simulador / Android Bridge / futuros "próximamente"), 11 escenarios del simulador, arrancar/parar motor, URLs y envío de telemetría          |
| `/ai`          | Chat del asistente (`POST ${API}/ai/ask`); si el backend no responde, respuesta local desde `DTC_KNOWLEDGE`                                            |

## Estado

`useVehicleStore` (Zustand) crea el `VehicleProvider` (simulador por defecto), se conecta, se suscribe **una sola vez** a `live()` y publica telemetría/DTC/estado. Los gauges de `@vehicleos/ui` animan internamente con rAF a 60 FPS.

## Regla de seguridad

**La PWA jamás toca Bluetooth ni hardware**: solo habla con `@vehicleos/vehicle-sdk`. El único proceso con acceso al adaptador OBD real es el Vehicle Bridge (servicio Android).

## Uso

```bash
cp .env.example .env.local   # NEXT_PUBLIC_API_URL / NEXT_PUBLIC_WS_URL
pnpm dev                     # http://localhost:3000
pnpm build && pnpm start
node scripts/generate-icons.mjs  # regenerar iconos PNG (sin dependencias)
```

El service worker (`public/sw.js`, solo en producción) cachea estáticos (cache-first) y deja API/WebSocket siempre en red.
