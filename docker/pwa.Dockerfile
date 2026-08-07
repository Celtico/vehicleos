# Cockpit PWA de VehicleOS (Next.js).
#
# Usa la salida "standalone" de Next: traza las dependencias que realmente
# usa el servidor y las copia, de modo que la imagen final no arrastra el
# monorepo ni node_modules completo.

# ── Compilación ──────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.5.0 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/pwa/package.json apps/pwa/
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
COPY apps/pwa apps/pwa

# Next incrusta las variables NEXT_PUBLIC_* en el JavaScript del navegador
# durante el build, así que tienen que llegar aquí y no en tiempo de
# ejecución: por eso son ARG y no solo ENV.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_WS_URL=ws://localhost:3001/telemetry
ARG NEXT_PUBLIC_SOCKET_PATH=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_SOCKET_PATH=$NEXT_PUBLIC_SOCKET_PATH
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm turbo run build --filter=@vehicleos/pwa

# ── Ejecución ────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# La salida standalone reproduce la estructura del monorepo dentro de
# .next/standalone, de ahí las rutas anidadas.
COPY --from=builder /app/apps/pwa/.next/standalone ./
COPY --from=builder /app/apps/pwa/.next/static ./apps/pwa/.next/static
COPY --from=builder /app/apps/pwa/public ./apps/pwa/public

USER node
EXPOSE 3000
CMD ["node", "apps/pwa/server.js"]
