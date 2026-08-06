/** Endpoints de alertas del usuario autenticado. */
import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import type { VehicleAlert } from "@vehicleos/shared";
import { AuthUser } from "../auth/auth-user";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AlertsService } from "./alerts.service";

@Controller("alerts")
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  /** GET /alerts — alertas de todos los vehículos del usuario. */
  @Get()
  list(@CurrentUser() user: AuthUser): Promise<VehicleAlert[]> {
    return this.alerts.listForUser(user.userId);
  }

  /** POST /alerts/:id/ack — reconoce (silencia) una alerta. */
  @Post(":id/ack")
  acknowledge(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<VehicleAlert> {
    return this.alerts.acknowledge(user.userId, id);
  }
}
