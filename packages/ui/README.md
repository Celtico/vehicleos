# @vehicleos/ui

Librería React de instrumentación estilo **Mercedes MBUX moderno**: fondo negro con degradados sutiles, tipografía fina, acentos cian-turquesa (`#00d2be`), plateados y glow ambiental.

## Componentes

- `GaugeArc` — arco genérico con valor, min/max, zonas de color, etiqueta y unidad.
- `SpeedGauge` / `RpmGauge` — arcos grandes del cuadro (zona roja en rpm).
- `LinearGauge` — barra para combustible, temperatura, tensión y turbo.
- `StatusLight` — testigos de motor/ABS/ESP/airbag (`ok | warning | error | unknown`).
- `BatteryIndicator`, `TelemetryTile`, `Screen`, `Card`.

## Animación

Los componentes reciben el último valor por props pero **no se re-renderizan por frame**: un bucle `requestAnimationFrame` interpola (lerp exponencial) hacia el objetivo y muta los atributos SVG directamente vía refs → 60 FPS reales aunque la telemetría llegue a 20 Hz.

React 18 es `peerDependency`. Compila a CJS en `dist/` con `tsc` (`jsx: react-jsx`).
