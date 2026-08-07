# Publicar VehicleOS con Nginx Proxy Manager

Guía del despliegue real, con los tres nombres que hay montados y
verificados en producción.

## Reparto de nombres

| Nombre                     | Destino             | Qué sirve       |
| -------------------------- | ------------------- | --------------- |
| `coche.serverscel.com`     | `192.168.1.55:7271` | Cockpit (PWA)   |
| `coche-api.serverscel.com` | `192.168.1.55:7272` | API y WebSocket |
| `vehicleos.serverscel.com` | `192.168.1.55:7270` | Landing         |

Son tres subdominios del **mismo dominio**, así que basta con un dominio
comprado y el comodín de DNS que ya tienes.

El cockpit ocupa la **raíz** de su nombre porque es una PWA: el service
worker toma como alcance la carpeta desde la que se sirve, y tanto el
`start_url` del manifiesto como el diálogo de instalación se complican si
cuelga de un subdirectorio.

La API tiene nombre propio. La alternativa era colgarla de `/api` del mismo
nombre que el cockpit —lo que elimina el CORS por ser el mismo origen—
mediante una _custom location_ de NPM, pero en la práctica dio problemas y
se descartó. Con nombres separados el CORS sí interviene, y por eso
`CORS_ORIGIN` tiene que ser exacto.

**La API conserva el prefijo `/api` aunque tenga subdominio propio**: sus
rutas viven en `https://coche-api.serverscel.com/api/…`. Es el valor de
`API_PREFIX` en el servidor, y hay que mantenerlo alineado con
`PUBLIC_API_URL` y `PUBLIC_SOCKET_PATH`.

## Variables del servidor

En el `.env` que acompaña al `docker-compose.yml`:

```bash
API_PREFIX=/api
CORS_ORIGIN=https://coche.serverscel.com
PUBLIC_API_URL=https://coche-api.serverscel.com/api
PUBLIC_WS_URL=https://coche-api.serverscel.com
PUBLIC_SOCKET_PATH=/api/socket.io
```

Las tres `PUBLIC_*` **se incrustan en el JavaScript durante la
compilación**, no se leen al arrancar. Después de cambiarlas hay que
reconstruir el cockpit:

```bash
docker compose up -d --build pwa
```

Es el fallo más habitual: se cambia el `.env`, se reinicia, y el navegador
sigue pidiendo a la dirección antigua porque está escrita dentro del
paquete.

## Los tres hosts en NPM

**Hosts → Proxy Hosts → Add Proxy Host** para cada uno.

### Cockpit

- Domain Names: `coche.serverscel.com`
- Forward: `http` → `192.168.1.55` : `7271`
- Block Common Exploits: activado
- SSL: certificado de Let's Encrypt, HTTP/2 activado

En la pestaña **Advanced**, para que un despliegue nuevo llegue a las
pantallas ya instaladas en vez de tardar días:

```nginx
location = /sw.js {
    proxy_pass http://192.168.1.55:7271/sw.js;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}
```

### API

- Domain Names: `coche-api.serverscel.com`
- Forward: `http` → `192.168.1.55` : `7272`
- **Websockets Support: activado** (sin esto no hay telemetría)
- Block Common Exploits: activado
- SSL: certificado de Let's Encrypt, HTTP/2 activado

En **Advanced**, porque una pantalla de coche mantiene el WebSocket abierto
durante horas y con el valor por defecto el proxy lo corta cada minuto:

```nginx
proxy_read_timeout 3600s;
proxy_send_timeout 3600s;
proxy_buffering off;
```

### Landing

- Domain Names: `vehicleos.serverscel.com`
- Forward: `http` → `192.168.1.55` : `7270`
- Block Common Exploits: activado
- SSL: certificado de Let's Encrypt

No necesita websockets ni configuración adicional.

## Force SSL: desactivado

En los tres. Si delante de NPM hay otro proxy que ya termina el TLS y
reenvía en HTTP —Cloudflare en modo Flexible, por ejemplo—, activarlo
provoca un **bucle infinito de redirecciones**: el proxy exterior manda la
petición en HTTP, NPM responde "redirige a HTTPS", y vuelta a empezar.

## Comprobación

```bash
# Cockpit y landing
curl -sI https://coche.serverscel.com | head -1
curl -sI https://vehicleos.serverscel.com | head -1

# API: 401 es la respuesta CORRECTA, es una ruta protegida
curl -s -o /dev/null -w "%{http_code}\n" \
  https://coche-api.serverscel.com/api/users/me

# socket.io debe devolver un sid y anunciar que puede subir a websocket
curl -s "https://coche-api.serverscel.com/api/socket.io/?EIO=4&transport=polling" | head -c 80

# CORS: debe responder con el origen del cockpit
curl -s -D - -o /dev/null -X OPTIONS \
  https://coche-api.serverscel.com/api/auth/login \
  -H "Origin: https://coche.serverscel.com" \
  -H "Access-Control-Request-Method: POST" | grep -i access-control-allow-origin
```

La prueba de fuego: abre el cockpit, ve a **Ajustes**, pega un token y el id
de un vehículo, activa el envío de telemetría y comprueba que el estado del
enlace pasa a "abierto".

## Cuando algo no va

**El cockpit no puede iniciar sesión.** Casi siempre es `PUBLIC_API_URL`
apuntando mal, o la imagen sin reconstruir tras cambiarla. Mira en las
herramientas de desarrollo a qué dirección está pidiendo.

**El navegador bloquea las peticiones por CORS.** `CORS_ORIGIN` tiene que
coincidir **exactamente** con el origen del cockpit, incluido el esquema y
sin barra final.

**El WebSocket reconecta sin parar.** Revisa que _Websockets Support_ esté
activado en el host de la API, que `PUBLIC_SOCKET_PATH` sea `API_PREFIX` +
`/socket.io`, y que estén puestos los timeouts largos.

**Falla la emisión del certificado.** NPM muestra un escueto "Internal
Error" y **crea el host igualmente**, pero con SSL en "HTTP only": el host
funciona, solo le falta el certificado. Let's Encrypt valida por HTTP-01
conectándose desde internet a
`http://TU_DOMINIO/.well-known/acme-challenge/…`, así que ese nombre debe
ser alcanzable desde fuera y resolver correctamente también dentro de la
LAN. Para añadir el certificado después: menú de tres puntos del host →
Edit → SSL → "Request a new SSL Certificate".

## Si no usas NPM

En `docker/proxy.example.conf` tienes el equivalente en nginx a pelo.
