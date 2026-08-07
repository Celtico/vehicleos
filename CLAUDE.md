# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

VehicleOS is a PWA-based car operating system in a Turborepo monorepo (pnpm workspaces). The PWA runs on Android car screens, tablets, phones and browsers. Documentation and code comments are written in **Spanish**.

## Commands

```bash
pnpm install                 # install everything
pnpm build                   # turbo build (respects dependency graph)
pnpm test                    # all tests (vitest in packages, jest in backend)
pnpm typecheck               # tsc --noEmit everywhere
pnpm --filter @vehicleos/pwa dev       # cockpit at localhost:3000 (simulator by default)
pnpm --filter @vehicleos/landing dev   # marketing site at localhost:3002 (static export to out/)
pnpm --filter @vehicleos/backend dev   # API at localhost:3001 (needs Postgres: docker compose up -d in apps/backend, then pnpm prisma:migrate)
```

Android bridge (not part of pnpm/turbo): `cd apps/android-bridge && ./gradlew assembleDebug`.

Run a single package's tests: `pnpm --filter @vehicleos/vehicle-simulator test`.

## Architecture — the golden rule

**The PWA never touches hardware.** The chain is always:
`PWA → packages/vehicle-sdk (VehicleProvider) → Android Vehicle Bridge → Bluetooth/BLE/USB/WiFi → OBD adapter`.

- `packages/shared` is the source of truth for all cross-cutting types: `VehicleTelemetry`, `DiagnosticTroubleCode`, the bridge JSON-RPC contract (`bridge.ts`, WS on 127.0.0.1:8722) and telemetry batch messages (`telemetry.ts`). Change contracts here first; everything else (SDK, PWA, backend gateway, Kotlin bridge) implements them.
- `packages/vehicle-sdk` defines `VehicleProvider` (`provider.ts`) and its implementations: `SimulatorProvider` (wraps `packages/vehicle-simulator`), `AndroidBridgeProvider` (JSON-RPC client), `MercedesProvider` (KWP2000 over the bridge's `raw` command, for ABS/ESP/airbag ECUs that generic OBD-II cannot reach — see `docs/mercedes-provider.md`), plus typed stubs for future providers (CAN, ThinkDiag, XTool). New data sources = new `VehicleProvider` implementation registered in `factory.ts`.
- `packages/vehicle-protocol` holds OBD-II/ELM327 knowledge (SAE J1979 PID formulas, DTC decoding) and the KWP2000/ISO 14230 codec used to address non-powertrain ECUs. The protocol mechanics are tested; ECU addresses are deliberately NOT hardcoded — `MercedesProvider.escanearModulos()` discovers them on the real car. The Kotlin bridge mirrors these formulas — keep them in sync.
- `packages/vehicle-simulator` is a physics simulation (virtual driver chasing a scenario speed profile, 6-gear rpm model, thermal/electrical/fuel models). Scenarios live in `scenarios.ts`; its `tick(dt)` is public so tests drive it deterministically without timers.
- TS packages compile to CommonJS in `dist/` via tsc; apps consume built output (turbo `build` has `dependsOn: ^build`).
- Real-time flow is push-only (WebSocket, `live()` subscriptions) — no HTTP polling. UI gauges animate via requestAnimationFrame interpolation, not React re-renders.
- The PWA↔backend link is **socket.io** (namespace `/telemetry`), not raw WebSocket: `packages/telemetry` talks through a `TelemetryTransport` seam whose default implementation is socket.io-client, and the socket.io event name is the `type` field of `TelemetryClientMessage` (`batch`, `trip-start`, `trip-end`). Tests inject a fake transport. Trips are delimited by `engineRunning` transitions in the telemetry stream — which is why `VehicleSimulator.stop()` must emit a final snapshot.
- Cockpit settings (provider, scenario, backend URL, JWT, vehicle id, telemetry toggle) persist in IndexedDB via `packages/storage` and are rehydrated by the store's `boot()`. Sending telemetry requires a JWT and a backend vehicle id entered in `/settings`; `CORS_ORIGIN` must match the PWA's origin.
- Backend (NestJS + Prisma/PostgreSQL) owns users/vehicles/trips/alerts; every vehicle belongs to a user and all queries are scoped by the JWT subject.

## Conventions

- Strict TypeScript everywhere; base config in `tsconfig.base.json`.
- Comments/JSDoc/READMEs in Spanish.
- Tests colocated as `*.test.ts` (vitest) in packages; backend uses jest.
- `apps/landing` is the marketing site: a separate static-export Next.js app, not part of the cockpit. Its screenshots in `public/img` are real product captures — regenerate them when the UI changes rather than letting them go stale.
- CI runs on **GitLab CI** (`.gitlab-ci.yml`): setup → quality (lint/format/typecheck) → build → test → android. There is no GitHub Actions workflow.
- `.claude/skills/` contains installed Agent Skills; `.claude/template/SKILL.md` is the template for new ones. Do not edit `.idea/`.
