# VehicleOS Android Bridge

Servicio Android nativo (Kotlin) **sin interfaz de usuario** que actúa de
puente entre el hardware OBD-II del vehículo y la PWA de VehicleOS.

> **Nota de monorepo**: esta app vive en `apps/android-bridge` pero **no
> participa** en el workspace pnpm/turbo. Se compila únicamente con Gradle.

## Regla de seguridad

**La PWA nunca ve Bluetooth, BLE, USB ni WiFi.** Este servicio es el
único proceso con acceso al hardware y solo expone la API JSON-RPC local
definida en `packages/shared/src/bridge.ts`:

- `ws://127.0.0.1:8722` — servidor WebSocket ligado **exclusivamente a
  loopback** (nada accesible desde la red).
- `window.VehicleBridge` — la misma API inyectada en una WebView con
  `addJavascriptInterface` (clase `VehicleBridgeWebViewInterface`).

Los métodos JSON-RPC (`connect`, `disconnect`, `status`, `read {pid}`,
`dtc`, `clearDtc`, `subscribe`, `unsubscribe`) son el equivalente de
`vehicle.connect()` / `speed()` / `rpm()` / `coolant()` / `errors()` /
`disconnect()` del SDK. Cualquier vulnerabilidad de la PWA queda así
aislada del bus del vehículo: el radio de acción máximo es esta API.

## Arquitectura

```
PWA / SDK (@vehicleos/vehicle-sdk)
        │  JSON-RPC (BridgeRequest/BridgeResponse/BridgeEvent)
        ▼
┌─ VehicleBridgeService (foreground, START_STICKY) ───────────┐
│  BridgeWebSocketServer (127.0.0.1:8722)                     │
│  VehicleBridgeWebViewInterface (window.VehicleBridge)       │
│          │ mismo BridgeDispatcher para ambas vías           │
│          ▼                                                  │
│  BridgeCore ── TelemetryLoop (solo con suscriptores) ── GPS │
│          │                                                  │
│          ▼                                                  │
│  Elm327Client (init ATZ…ATSP0, fórmulas SAE, mutex)         │
│          ▼                                                  │
│  ObdTransport: Bluetooth SPP │ BLE FFF0/FFF1/FFF2 │         │
│                USB serie     │ WiFi TCP 192.168.0.10:35000  │
└─────────────────────────────────────────────────────────────┘
```

- **Sin Activity**: el único elemento visible es la notificación
  persistente que Android exige a todo foreground service (canal
  silencioso de baja importancia, "VehicleOS Bridge activo").
- **Batería**: el adaptador solo se sondea mientras haya al menos un
  suscriptor (`subscribe`); al desconectarse el último cliente, el bucle
  de telemetría y el GPS se detienen.
- **Telemetría**: ~6-7 Hz con el JSON **exacto** de `VehicleTelemetry`
  (`packages/shared/src/vehicle.ts`). El odómetro se integra a partir de
  la velocidad (OBD-II estándar no lo expone) y se persiste.
- **`read`** acepta las claves de PID del contrato TS (`SPEED`, `RPM`,
  `COOLANT_TEMP`, `CONTROL_MODULE_VOLTAGE`, `FUEL_LEVEL`…) más la clave
  virtual `BOOST` (MAP 0x0B − barométrica 0x33, en bar).
- **Errores**: `{code, message}` — `1000` petición inválida, `1001` sin
  adaptador, `1002` timeout, `1003` PID desconocido, `1500` interno.

## Transportes

Selección con la preferencia `transport` (`auto` por defecto):

| Valor       | Implementación             | Detalles                                        |
| ----------- | -------------------------- | ----------------------------------------------- |
| `bluetooth` | RFCOMM SPP                 | UUID `00001101-…`, emparejado por nombre        |
| `ble`       | GATT                       | servicio `FFF0`, `FFF1` notify + `FFF2` write   |
| `usb`       | usb-serial-for-android     | FTDI/CH340/CP210x/CDC-ACM, 38400 baudios        |
| `wifi`      | Socket TCP                 | `192.168.0.10:35000` (configurable)             |

Autodetección (`auto`): USB enchufado → Bluetooth emparejado (clásico o
LE según el tipo del dispositivo) → WiFi como último recurso.

La configuración se persiste en SharedPreferences y puede fijarse con los
extras del broadcast de arranque (ver más abajo).

## Compilar

Requisitos: JDK 17, Android SDK (plataforma 34) y Gradle (wrapper
incluido si ya se generó; si no, con un Gradle ≥ 8.7 instalado ejecuta
`gradle wrapper --gradle-version 8.7` una vez).

```bash
cd apps/android-bridge
./gradlew assembleDebug          # APK en app/build/outputs/apk/debug/
./gradlew testDebugUnitTest      # tests JVM del códec ELM327/DTC
```

## Instalar y arrancar

```bash
adb install app/build/outputs/apk/debug/app-debug.apk

# Permisos de runtime (no hay UI desde la que pedirlos):
adb shell pm grant os.vehicle.bridge android.permission.ACCESS_FINE_LOCATION
adb shell pm grant os.vehicle.bridge android.permission.BLUETOOTH_CONNECT
adb shell pm grant os.vehicle.bridge android.permission.BLUETOOTH_SCAN
adb shell pm grant os.vehicle.bridge android.permission.POST_NOTIFICATIONS

# Arrancar el servicio:
adb shell am broadcast -a os.vehicle.bridge.START

# Con configuración:
adb shell am broadcast -a os.vehicle.bridge.START \
    --es transport wifi --es wifiHost 192.168.0.10 --ei wifiPort 35000
```

El servicio también arranca solo tras cada reinicio (`BOOT_COMPLETED`).

Prueba rápida desde el propio dispositivo (la PWA haría lo mismo):

```js
const ws = new WebSocket("ws://127.0.0.1:8722");
ws.onmessage = (e) => console.log(e.data);
ws.onopen = () => {
  ws.send(JSON.stringify({ id: 1, method: "connect" }));
  ws.send(JSON.stringify({ id: 2, method: "read", params: { pid: "RPM" } }));
  ws.send(JSON.stringify({ id: 3, method: "subscribe" })); // eventos "telemetry"
};
```
