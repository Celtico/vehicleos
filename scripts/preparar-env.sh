#!/usr/bin/env bash
#
# Crea el fichero .env a partir de .env.example, generando los secretos en
# esta máquina.
#
# Los secretos se generan aquí y no vienen escritos en el repositorio a
# propósito: una contraseña versionada es una contraseña pública, y el
# JWT_SECRET firma las sesiones (quien lo tenga puede hacerse pasar por
# cualquier usuario).
#
#   ./scripts/preparar-env.sh
#   ./scripts/preparar-env.sh coche.serverscel.com vehicleos.serverscel.com
#
set -euo pipefail

cd "$(dirname "$0")/.."

DOMINIO_APP="${1:-coche.serverscel.com}"
DOMINIO_LANDING="${2:-vehicleos.serverscel.com}"

if [ -f .env ]; then
  echo "Ya existe un .env. No se toca: si quieres regenerarlo, muévelo antes."
  echo "   mv .env .env.viejo && $0 $DOMINIO_APP $DOMINIO_LANDING"
  exit 1
fi

for cmd in openssl; do
  command -v "$cmd" >/dev/null || { echo "Falta '$cmd'."; exit 1; }
done

POSTGRES_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)"
JWT_SECRET="$(openssl rand -hex 32)"

cat > .env <<EOF
# Generado por scripts/preparar-env.sh el $(date +%Y-%m-%d).
# Contiene secretos: no lo subas al repositorio (ya está en .gitignore).

# ── Base de datos ───────────────────────────────────────────────────
POSTGRES_USER=vehicleos
POSTGRES_DB=vehicleos
POSTGRES_PASSWORD=$POSTGRES_PASSWORD

# ── Backend ─────────────────────────────────────────────────────────
JWT_SECRET=$JWT_SECRET
API_PREFIX=/api
CORS_ORIGIN=https://$DOMINIO_APP

# Opcional: sin ella el asistente responde con diagnóstico local.
ANTHROPIC_API_KEY=

# ── URL públicas (se incrustan en el build del cockpit) ─────────────
PUBLIC_API_URL=https://$DOMINIO_APP/api
PUBLIC_WS_URL=https://$DOMINIO_APP
PUBLIC_SOCKET_PATH=/api/socket.io

# ── Puertos publicados ──────────────────────────────────────────────
LANDING_PORT=7270
PWA_PORT=7271
BACKEND_PORT=7272
EOF

chmod 600 .env

echo "Listo. .env creado con permisos 600 y secretos generados."
echo
echo "  Cockpit : https://$DOMINIO_APP"
echo "  Landing : https://$DOMINIO_LANDING"
echo
echo "Comprueba que los puertos están libres antes de levantar:"
echo "  ss -lntp | grep -E ':(7270|7271|7272)\b' || echo '  libres'"
echo
echo "Y arranca con:"
echo "  docker compose up -d --build"
