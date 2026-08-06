# @vehicleos/ai

Inteligencia de diagnóstico de VehicleOS:

- **`DTC_KNOWLEDGE`** — base local con 16 códigos comunes (P0300, P0171, P0401, P0420, P0128, P0217, P0299, P0442, P0455, P0562, P2263, C0035, C1234, B0001, U0100, P0301). Cada entrada: `{code, title, system, probableCause, probability, causes[], solutions[], severity, canDrive}`.
- **`explainDtc(code)`** — busca en la base; si el código no existe devuelve una explicación **genérica por categoría** (P/C/B/U) usando `dtcCategory` de `@vehicleos/vehicle-protocol`. Nunca lanza.
- **`AssistantClient`** — `POST ${apiUrl}/ai/ask` con `{question, telemetry, dtc}`; devuelve `{answer}` del backend (token JWT opcional, timeout configurable, `fetch` inyectable).
- **`buildLocalAnswer(request)`** — respuesta local degradada construida desde la base cuando el backend no responde (la usa la pantalla `/ai` de la PWA).

Tests: `pnpm test` (vitest, cubren `explainDtc` y la coherencia de la base).
