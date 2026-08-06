/**
 * Módulo de telemetría con separación comando/consulta (CQRS ligero):
 *  - TelemetryIngestService: comandos (ingesta, DTCs, reglas de alertas).
 *  - TelemetryQueryService: consultas (series y agregados).
 *  - TelemetryGateway: WebSocket en tiempo real (namespace /telemetry).
 */
import { Module } from "@nestjs/common";
import { AlertsModule } from "../alerts/alerts.module";
import { AuthModule } from "../auth/auth.module";
import { TripsModule } from "../trips/trips.module";
import { VehiclesModule } from "../vehicles/vehicles.module";
import { TelemetryController } from "./telemetry.controller";
import { TelemetryGateway } from "./telemetry.gateway";
import { TelemetryIngestService } from "./telemetry-ingest.service";
import { TelemetryQueryService } from "./telemetry-query.service";

@Module({
  imports: [AuthModule, VehiclesModule, AlertsModule, TripsModule],
  controllers: [TelemetryController],
  providers: [TelemetryIngestService, TelemetryQueryService, TelemetryGateway],
})
export class TelemetryModule {}
