# Landing de VehicleOS.
#
# Es un sitio estático, así que no necesita Node en producción: se compila y
# se sirve con nginx.

# ── Compilación ──────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.5.0 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/landing/package.json apps/landing/
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

COPY apps/landing apps/landing
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @vehicleos/landing run build

# ── Ejecución ────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner
COPY --from=builder /app/apps/landing/out /usr/share/nginx/html
COPY docker/landing.nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
