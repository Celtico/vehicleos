# @vehicleos/telemetry

`TelemetryClient`: puente entre el `VehicleProvider` (de `@vehicleos/vehicle-sdk`) y el backend.

## Funcionamiento

1. Se suscribe **una vez** a `provider.live()` y guarda la última instantánea.
2. Muestrea a **1 Hz** con `toTelemetrySample()` de `@vehicleos/shared`.
3. Agrupa lotes de **N muestras** (5 por defecto) y los envía por **WebSocket** como `TelemetryClientMessage` (`{type:"batch"}`), con el token JWT en la query (`?token=...`). Sin polling HTTP.
4. Si el socket cae, los lotes se **encolan** en `@vehicleos/storage` (IndexedDB) y se reintenta la conexión con **backoff exponencial** (1 s → 30 s). Al reconectar la cola se **drena en orden**.
5. Los DTC solo viajan en el lote cuando **han cambiado**.

La fábrica de WebSocket es inyectable (`webSocketFactory`) para los tests (`pnpm test`, vitest con socket falso y timers simulados).
