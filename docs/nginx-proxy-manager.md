# Publicar VehicleOS con Nginx Proxy Manager

Guía paso a paso para el reparto de dominios de VehicleOS en NPM.

## Por qué dos nombres

Hacen falta dos, y **pueden ser subdominios del mismo dominio**:

| Nombre                     | Qué sirve                        |
| -------------------------- | -------------------------------- |
| `coche.serverscel.com`     | Cockpit (raíz) y API bajo `/api` |
| `vehicleos.serverscel.com` | Landing                          |

El cockpit ocupa la **raíz** de su dominio porque es una PWA: el service
worker toma como alcance la carpeta desde la que se sirve, y tanto el
`start_url` del manifiesto como el diálogo de instalación se complican si
cuelga de un subdirectorio. La landing no tiene esa exigencia, así que es
la que se muda a otro nombre.

Que la API viva bajo `/api` del **mismo** dominio que el cockpit no es un
capricho: al compartir origen desaparece el CORS, que es la causa más
habitual de que un despliegue deje de funcionar sin motivo aparente.

## Antes de empezar

En el `.env` del servidor:

```bash
API_PREFIX=/api
CORS_ORIGIN=https://coche.serverscel.com
PUBLIC_API_URL=https://coche.serverscel.com/api
PUBLIC_WS_URL=https://coche.serverscel.com
PUBLIC_SOCKET_PATH=/api/socket.io
```

**El backend sirve ya bajo `/api`** gracias a `API_PREFIX`. Eso es
deliberado: las _custom locations_ de NPM reenvían la ruta tal cual, sin
quitar el prefijo, así que hacerlo en el servidor evita tener que escribir
reglas de reescritura en las cajas de configuración avanzada, que es justo
donde se cuelan los errores difíciles de ver.

Y recuerda: `PUBLIC_*` se incrusta en el JavaScript durante la compilación,
así que después de cambiarlas hay que reconstruir el cockpit:

```bash
docker compose up -d --build pwa
```

## Host 1 — cockpit y API

**Hosts → Proxy Hosts → Add Proxy Host**

Pestaña **Details**:

- Domain Names: `coche.serverscel.com`
- Scheme: `http`
- Forward Hostname / IP: la IP del servidor donde corre Docker
- Forward Port: `7271` (el cockpit)
- **Websockets Support: activado**
- Block Common Exploits: activado

Pestaña **Custom locations** → _Add location_:

- Location: `/api`
- Scheme: `http`
- Forward Hostname / IP: la misma IP
- Forward Port: `7272` (el backend)

Y en el engranaje de esa misma location, pega esto:

```nginx
# La telemetría mantiene el WebSocket abierto durante horas; con el valor
# por defecto el proxy lo corta cada minuto y el cliente reconecta sin parar.
proxy_read_timeout 3600s;
proxy_send_timeout 3600s;
proxy_buffering off;

proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

Pestaña **Advanced** del host:

```nginx
# El service worker no debe cachearse: si se cachea, un despliegue nuevo
# tarda días en llegar a las pantallas que ya lo tienen instalado.
location = /sw.js {
    proxy_pass http://IP_DEL_SERVIDOR:7271/sw.js;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}
```

Pestaña **SSL**: certificado nuevo de Let's Encrypt y _HTTP/2 Support_
activado.

**Force SSL, desactivado.** Si delante de NPM hay otro proxy que ya termina
el TLS y reenvía en HTTP (Cloudflare en modo Flexible, por ejemplo),
activarlo provoca un bucle infinito de redirecciones: el proxy exterior
manda la petición en HTTP, NPM responde "redirige a HTTPS", y vuelta a
empezar.

## Host 2 — landing

**Add Proxy Host**, mucho más simple:

- Domain Names: `vehicleos.serverscel.com`
- Forward Hostname / IP: la IP del servidor
- Forward Port: `7270`
- Block Common Exploits: activado
- SSL: certificado de Let's Encrypt, sin Force SSL (mismo motivo que arriba)

No necesita websockets ni locations adicionales.

## Comprobación

```bash
# El cockpit responde en la raíz
curl -sI https://coche.serverscel.com | head -1

# La API responde bajo /api (401 es correcto: es una ruta protegida)
curl -s -o /dev/null -w "%{http_code}\n" https://coche.serverscel.com/api/users/me

# La landing
curl -sI https://vehicleos.serverscel.com | head -1
```

Para el WebSocket, abre el cockpit, ve a **Ajustes**, pega el token y el id
del vehículo, activa el envío de telemetría y comprueba que el estado del
enlace pasa a "abierto". Si se queda reconectando, casi siempre es una de
estas tres:

1. **Websockets Support** desactivado en el host del cockpit.
2. `PUBLIC_SOCKET_PATH` no coincide con `API_PREFIX` + `/socket.io`.
3. El cockpit no se reconstruyó tras cambiar las variables `PUBLIC_*`.

## Si falla la emisión del certificado

NPM muestra un escueto "Internal Error" y crea el host igualmente, pero con
SSL en "HTTP only". El host funciona; solo falta el certificado.

Let's Encrypt valida por HTTP-01 conectándose desde internet a
`http://TU_DOMINIO/.well-known/acme-challenge/…`, así que necesita que ese
nombre sea alcanzable desde fuera. Si tu red no lo permite, usa **Use a DNS
Challenge** con el proveedor de tu DNS y su token de API: valida creando un
registro TXT, sin ninguna conexión entrante.

Para añadir el certificado después, entra en el menú de tres puntos del
host → Edit → SSL → "Request a new SSL Certificate".

## Si no usas NPM

En `docker/proxy.example.conf` tienes el equivalente en nginx a pelo.
