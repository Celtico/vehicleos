/** CRUD de vehículos, siempre limitado al usuario del token. */
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import type { Vehicle } from "@prisma/client";
import { AuthUser } from "../auth/auth-user";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateVehicleDto } from "./dto/create-vehicle.dto";
import { UpdateVehicleDto } from "./dto/update-vehicle.dto";
import { VehicleStatus, VehiclesService } from "./vehicles.service";

@Controller("vehicles")
@UseGuards(JwtAuthGuard)
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  /** POST /vehicles */
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateVehicleDto): Promise<Vehicle> {
    return this.vehicles.create(user.userId, dto);
  }

  /** GET /vehicles */
  @Get()
  findAll(@CurrentUser() user: AuthUser): Promise<Vehicle[]> {
    return this.vehicles.findAll(user.userId);
  }

  /** GET /vehicles/:id */
  @Get(":id")
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<Vehicle> {
    return this.vehicles.findOne(user.userId, id);
  }

  /** PATCH /vehicles/:id */
  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateVehicleDto,
  ): Promise<Vehicle> {
    return this.vehicles.update(user.userId, id, dto);
  }

  /** DELETE /vehicles/:id */
  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<{ deleted: true }> {
    return this.vehicles.remove(user.userId, id);
  }

  /** GET /vehicles/:id/status — última muestra + DTCs activos + alertas pendientes. */
  @Get(":id/status")
  status(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<VehicleStatus> {
    return this.vehicles.status(user.userId, id);
  }
}
