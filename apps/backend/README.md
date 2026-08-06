# @vehicleos/backend

API de VehicleOS construida con NestJS 10, Prisma (PostgreSQL) y socket.io.
Arquitectura por módulos de dominio (DDD ligero) con separación
comando/consulta en telemetría (CQRS ligero).

## Requisitos

- Node >= 20 y pnpm 9 (se instala desde la raíz del monorepo).
- Docker (para el PostgreSQL de desarrollo).

## Arranque rápido

```bash
# 1. Dependencias (desde la raíz del monorepo)
pnpm install

# 2. Variables de entorno
cd apps/backend
cp .env.example .env

# 3. PostgreSQL 16 de desarrollo
docker compose up -d

# 4. Cliente y migraciones de Prisma
pnpm prisma:generate
pnpm prisma:migrate   # prisma migrate dev

# 5. Arrancar en modo desarrollo (puerto 3001)
pnpm dev
```

CORS está habilitado para `http://localhost:3000` (panel web).

## Scripts

| Script                 | Descripción                             |
| ---------------------- | --------------------------------------- |
| `pnpm dev`             | `nest start --watch`                    |
| `pnpm build`           | Compila a `dist/`                       |
| `pnpm start`           | Ejecuta `dist/main.js`                  |
| `pnpm test`            | Tests unitarios (jest, Prisma mockeado) |
| `pnpm typecheck`       | `tsc --noEmit`                          |
| `pnpm lint`            | ESLint sobre `src/`                     |
| `pnpm prisma:generate` | Genera el cliente de Prisma             |
| `pnpm prisma:migrate`  | `prisma migrate dev`                    |

## Endpoints HTTP

Autenticación con `Authorization: Bearer <accessToken>` salvo en `/auth/*`.

- `POST /auth/register` — `{ email, password, name }` → `{ accessToken, user }`
- `POST /auth/login` — `{ email, password }` → `{ accessToken, user }`
- `GET  /users/me` — perfil del usuario del token
- `POST /vehicles` · `GET /vehicles` · `GET /vehicles/:id` · `PATCH /vehicles/:id` · `DELETE /vehicles/:id`
- `GET  /vehicles/:id/status` — última muestra + DTCs activos + alertas sin reconocer
- `GET  /vehicles/:id/telemetry?from&to&limit` — serie temporal para gráficas (epoch ms)
- `GET  /vehicles/:id/stats` — km recorridos, velocidad media/máx, consumo medio, nº muestras
- `GET  /vehicles/:id/trips` — viajes del vehículo
- `GET  /alerts` — alertas de los vehículos del usuario
- `POST /alerts/:id/ack` — reconoce una alerta
- `POST /ai/dtc` — `{ code, telemetry? }` → explicación del código (`source: "claude" | "local"`)
- `POST /ai/ask` — `{ question, telemetry?, dtc? }` → respuesta del mecánico virtual

Todos los recursos están limitados al propietario: nadie puede ver ni tocar
vehículos, viajes, telemetría o alertas de otro usuario.

## WebSocket (socket.io, namespace `/telemetry`)

Conexión autenticada con el JWT en el handshake:

```ts
io("http://localhost:3001/telemetry", { auth: { token: accessToken } });
// o bien: ?token=<accessToken> en la query
```

Eventos que emite el cliente:

- `batch` — `TelemetryBatch { vehicleId, samples[], dtc? }`: persiste muestras,
  sincroniza DTCs y evalúa las reglas de alertas. Respuesta: `ack { received }`.
- `trip-start` — `{ vehicleId, startedAt }`: abre un viaje.
- `trip-end` — `{ vehicleId, endedAt }`: cierra el viaje y calcula distancia,
  velocidades, consumo estimado y ruta.
- `watch` — `{ vehicleId }`: une el socket a la sala del vehículo (solo el
  propietario) para recibir datos en tiempo real. Sin polling.

Eventos que emite el servidor:

- `ack { received }` — confirmación de cada lote.
- `live { vehicleId, samples, dtc? }` — cada lote entrante, a la sala del vehículo.
- `alert` — alerta nueva (al emisor y a la sala).
- `trip-started` / `trip-ended` — ciclo de vida del viaje.
- `watching { vehicleId }` — confirmación de suscripción.
- `error { message }` — error de autenticación, propiedad o validación.

## Reglas automáticas de alertas

Al ingerir telemetría se evalúa cada muestra:

| Condición                                                 | Alerta                    |
| --------------------------------------------------------- | ------------------------- |
| `coolantTemp > 105 °C`                                    | `critical` — `overheat`   |
| `batteryVoltage < 11.8 V` con motor en marcha (rpm > 500) | `warning` — `low-battery` |
| `fuelLevel < 10 %`                                        | `info` — `low-fuel`       |
| DTC nuevo                                                 | `warning` — `dtc`         |

No se duplican alertas del mismo tipo mientras haya una sin reconocer.

## Asistente IA

Si `ANTHROPIC_API_KEY` está definida, `/ai/dtc` y `/ai/ask` consultan a Claude
(`claude-sonnet-5`) con un prompt de mecánico experto en español que usa los
datos reales del coche. Sin API key, responden `200` con un diagnóstico local
determinista construido solo a partir del código y la telemetría recibidos
(campo `source: "local"`). No hay ninguna clave en el código.

## Notas de diseño

- `TelemetryIngestService` (comandos) y `TelemetryQueryService` (consultas)
  separan escritura y lectura de telemetría (CQRS ligero).
- El consumo por viaje se estima con la caída de `fuelLevel` asumiendo un
  depósito de 50 L (las muestras no incluyen litros); la distancia usa GPS
  (haversine) y, si no hay ruta, integra la velocidad en el tiempo.
- Los tests unitarios mockean Prisma: no hace falta Postgres para `build`/`test`.
