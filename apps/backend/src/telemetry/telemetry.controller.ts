/** Endpoints de consulta de telemetría (lado de lectura del CQRS). */
import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import type { TelemetrySample } from "@vehicleos/shared";
import { AuthUser } from "../auth/auth-user";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { TelemetryQueryDto } from "./dto/telemetry-query.dto";
import { TelemetryQueryService, TelemetryStats } from "./telemetry-query.service";

@Controller("vehicles/:id")
@UseGuards(JwtAuthGuard)
export class TelemetryController {
  constructor(private readonly queries: TelemetryQueryService) {}

  /** GET /vehicles/:id/telemetry?from&to&limit — serie para gráficas. */
  @Get("telemetry")
  series(
    @CurrentUser() user: AuthUser,
    @Param("id") vehicleId: string,
    @Query() query: TelemetryQueryDto,
  ): Promise<TelemetrySample[]> {
    return this.queries.getSeries(user.userId, vehicleId, query);
  }

  /** GET /vehicles/:id/stats — agregados del vehículo. */
  @Get("stats")
  stats(
    @CurrentUser() user: AuthUser,
    @Param("id") vehicleId: string,
  ): Promise<TelemetryStats> {
    return this.queries.getStats(user.userId, vehicleId);
  }
}
