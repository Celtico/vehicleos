/**
 * @vehicleos/telemetry — cliente de telemetría por WebSocket (socket.io).
 */
export {
  TelemetryClient,
  type TelemetryClientOptions,
  type TelemetryLinkState,
} from "./client";
export {
  normalizeSocketUrl,
  type TelemetryTransport,
  type TransportFactory,
  type TransportOptions,
} from "./transport";
export { createSocketIoTransport } from "./socketio-transport";
