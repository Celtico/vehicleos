# @vehicleos/storage

Wrapper de **IndexedDB sin dependencias** para VehicleOS:

- `createOfflineQueue()` — cola FIFO persistente de `TelemetryBatch` (`push` / `drain` / `size` / `clear`). La usa `@vehicleos/telemetry` cuando el WebSocket está caído.
- `createKeyValueStore()` — almacén clave-valor para ajustes de la PWA.

Si el entorno no tiene `indexedDB` (SSR de Next, Node, tests) las fábricas **degradan a implementaciones en memoria** con el mismo contrato asíncrono.

Base de datos única `vehicleos` con los stores `telemetry-queue` (clave autoincremental) y `settings`.

Tests: `pnpm test` (vitest, cubren el fallback en memoria).
