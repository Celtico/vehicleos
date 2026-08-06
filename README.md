# VehicleOS

Sistema operativo para coches basado en una PWA. Funciona en pantallas Android de automóvil, tablets, móviles y navegadores web. Completamente modular.

## Arquitectura

```
apps/
  pwa             → Cockpit PWA (Next.js App Router, Tailwind, React Query, Zustand)
  backend         → API NestJS (REST + WebSocket, PostgreSQL + Prisma, JWT)
  android-bridge  → Servicio Android en Kotlin (único proceso con acceso al hardware)

packages/
  shared            → Tipos y contratos compartidos (telemetría, DTC, bridge JSON-RPC)
  vehicle-protocol  → Protocolo OBD-II / ELM327 (PIDs SAE J1979, decodificación DTC)
  vehicle-sdk       → Interfaz VehicleProvider + implementaciones (simulador, bridge, futuros)
  vehicle-simulator → Simulador físico con escenarios (arranque, ciudad, averías…)
  ui                → Componentes de instrumentación estilo Mercedes (60 FPS)
  telemetry         → Cliente de telemetría (lotes por WebSocket, cola offline)
  ai                → Base de conocimiento de DTC + cliente del asistente
  storage           → Almacenamiento local (IndexedDB con fallback en memoria)
```

### Regla de oro de seguridad

**La PWA nunca accede al hardware.** La cadena es siempre:

```
PWA → @vehicleos/vehicle-sdk → Vehicle Bridge (Android) → Bluetooth/BLE/USB/WiFi → OBD
```

- El **Vehicle Bridge** es un servicio Android sin interfaz, el único proceso con
  permisos de hardware. Expone una API JSON-RPC local (`ws://127.0.0.1:8722`).
- El **SDK** (`VehicleProvider`) es la única puerta de entrada de la PWA:
  `connect()`, `speed()`, `rpm()`, `coolant()`, `battery()`, `turbo()`, `fuel()`,
  `dtc()`, `clearDtc()`, `live()`, `disconnect()`.
- Para desarrollar sin coche está el `SimulatorProvider`, con 11 escenarios
  (arranque en frío, ciudad, autopista, sobrecalentamiento, modo emergencia,
  ABS/ESP averiado, fallo de carga…).

## Puesta en marcha

Requisitos: Node ≥ 20, pnpm 9, Docker (para PostgreSQL), Android SDK (solo para el bridge).

```bash
pnpm install

# Todo el monorepo
pnpm build          # compila (turbo orquesta las dependencias)
pnpm test           # tests
pnpm dev            # modo desarrollo de todos los targets

# PWA (cockpit) — http://localhost:3000
pnpm --filter @vehicleos/pwa dev

# Backend — http://localhost:3001 (levanta antes la base de datos)
cd apps/backend && docker compose up -d && pnpm prisma:migrate
pnpm --filter @vehicleos/backend dev

# Bridge Android
cd apps/android-bridge && ./gradlew assembleDebug
```

La PWA arranca por defecto con el **simulador**, así que no hace falta backend
ni hardware para ver el cockpit funcionando: `pnpm --filter @vehicleos/pwa dev`.

### Conectar la PWA con el backend

Cada coche pertenece a un usuario, así que el cockpit necesita credenciales
para enviar telemetría. Una vez levantado el backend:

```bash
# 1. Crear usuario y quedarse con el accessToken
curl -X POST localhost:3001/auth/register -H 'content-type: application/json' \
  -d '{"email":"yo@ejemplo.com","password":"secreto123","name":"Yo"}'

# 2. Crear el coche y quedarse con su id
curl -X POST localhost:3001/vehicles -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"name":"Mi coche","make":"Generic","model":"Sedan","year":2019}'
```

En **Ajustes → Backend y telemetría** pega el token y el id del vehículo, y
activa el envío. A partir de ahí las muestras se persisten, las reglas de
alerta se evalúan y arrancar/parar el motor abre y cierra un viaje.

Si sirves la PWA en un puerto u origen distinto de `http://localhost:3000`,
ajusta `CORS_ORIGIN` en el backend o el navegador bloqueará las peticiones.

## Rendimiento

- Telemetría push por WebSocket de extremo a extremo; **sin polling** en la PWA.
- Los gauges animan con `requestAnimationFrame` interpolando el último valor
  (60 FPS reales sin re-render de React por frame).
- El bridge solo sondea el adaptador OBD mientras haya suscriptores (batería).

## CI/CD

El pipeline vive en `.gitlab-ci.yml` (GitLab CI) con cinco etapas: `setup`
(instala dependencias y genera el cliente Prisma, cacheando el store de pnpm),
`quality` (lint, formato y typecheck en paralelo), `build`, `test` y `android`
(compila el APK del bridge con Gradle, solo si existe el wrapper).

Los artefactos de build se comparten entre etapas y el APK de depuración queda
publicado como artefacto del pipeline.

## Providers futuros

`vehicle-sdk` ya define stubs tipados para: CAN directo, ThinkDiag, XTool y
protocolo propietario Mercedes. Implementar uno = implementar `VehicleProvider`.
