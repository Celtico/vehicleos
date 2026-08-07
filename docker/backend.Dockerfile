# Backend de VehicleOS (NestJS + Prisma).
#
# El monorepo se construye entero en la fase de compilación porque el backend
# depende de paquetes del workspace; la imagen final solo se queda con lo
# necesario para ejecutarlo.

# ── Compilación ──────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Prisma necesita OpenSSL para elegir su motor de consultas.
RUN apt-get update -qq \
 && apt-get install -y -qq --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.5.0 --activate

# Primero los manifiestos: si no cambian, Docker reutiliza la capa de
# dependencias aunque cambie el código.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/backend/package.json apps/backend/
COPY packages/shared/package.json packages/shared/
COPY packages/vehicle-protocol/package.json packages/vehicle-protocol/
COPY packages/vehicle-simulator/package.json packages/vehicle-simulator/
COPY packages/vehicle-sdk/package.json packages/vehicle-sdk/
COPY packages/storage/package.json packages/storage/
COPY packages/telemetry/package.json packages/telemetry/
COPY packages/ai/package.json packages/ai/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile

COPY packages packages
COPY apps/backend apps/backend
RUN pnpm --filter @vehicleos/backend run prisma:generate \
 && pnpm turbo run build --filter=@vehicleos/backend

# Nota sobre el tamaño: la imagen se lleva el node_modules del workspace
# entero (~800 MB) porque los enlaces simbólicos de pnpm entre paquetes no
# sobreviven a una poda selectiva. Se probaron `pnpm deploy` (deja el
# node_modules vacío en esta configuración) y `pnpm prune --prod` (no
# elimina dependencias de desarrollo). Es el precio de un despliegue
# fiable; si algún día molesta, la vía es publicar los paquetes del
# workspace en un registro privado.

# ── Ejecución ────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update -qq \
 && apt-get install -y -qq --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/packages ./packages
COPY --from=builder --chown=node:node /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder --chown=node:node /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=builder --chown=node:node /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=builder --chown=node:node /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json

# Usuario sin privilegios: el proceso no necesita ser root.
USER node

WORKDIR /app/apps/backend
EXPOSE 3001

# Las migraciones se aplican al arrancar: así un despliegue nuevo deja la
# base de datos lista sin pasos manuales.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/main.js"]
