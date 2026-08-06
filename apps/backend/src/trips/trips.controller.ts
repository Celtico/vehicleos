/** Endpoints de viajes por vehículo. */
import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import type { Trip } from "@vehicleos/shared";
import { AuthUser } from "../auth/auth-user";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { TripsService } from "./trips.service";

@Controller("vehicles/:id/trips")
@UseGuards(JwtAuthGuard)
export class TripsController {
  constructor(private readonly trips: TripsService) {}

  /** GET /vehicles/:id/trips */
  @Get()
  list(@CurrentUser() user: AuthUser, @Param("id") vehicleId: string): Promise<Trip[]> {
    return this.trips.listForVehicle(user.userId, vehicleId);
  }
}
