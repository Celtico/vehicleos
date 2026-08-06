/**
 * @vehicleos/ui — instrumentación React estilo Mercedes MBUX.
 *
 * Todos los gauges reciben el último valor como prop y lo animan
 * internamente con requestAnimationFrame (60 FPS reales sin re-render).
 */
export { useAnimatedNumber, clamp } from "./animation";
export { describeArc, polarToCartesian } from "./arc";
export { MBUX, zoneColor, type GaugeZone } from "./theme";
export { GaugeArc, type GaugeArcProps } from "./GaugeArc";
export { SpeedGauge, type SpeedGaugeProps } from "./SpeedGauge";
export { RpmGauge, type RpmGaugeProps } from "./RpmGauge";
export { LinearGauge, type LinearGaugeProps } from "./LinearGauge";
export { StatusLight, type StatusLightProps, type StatusLightKind } from "./StatusLight";
export { BatteryIndicator, type BatteryIndicatorProps } from "./BatteryIndicator";
export { TelemetryTile, type TelemetryTileProps } from "./TelemetryTile";
export {
  TimeSeriesChart,
  submuestrear,
  type TimeSeriesChartProps,
  type SeriesPoint,
} from "./TimeSeriesChart";
export {
  NotificationStack,
  type NotificationStackProps,
  type CockpitNotification,
  type NotificationSeverity,
} from "./Notifications";
export { Screen, Card, type ScreenProps, type CardProps } from "./layout";
export {
  VehicleModel,
  type VehicleModelProps,
  type VehiclePartId,
  type PartSeverity,
} from "./VehicleModel";
export { WheelBadge, type WheelBadgeProps } from "./WheelBadge";
