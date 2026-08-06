/** Módulo de viajes. */
import { Module } from "@nestjs/common";
import { VehiclesModule } from "../vehicles/vehicles.module";
import { TripsController } from "./trips.controller";
import { TripsService } from "./trips.service";

@Module({
  imports: [VehiclesModule],
  controllers: [TripsController],
  providers: [TripsService],
  exports: [TripsService],
})
export class TripsModule {}
