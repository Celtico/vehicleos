/** Módulo raíz: composición de todos los módulos de dominio. */
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AiModule } from "./ai/ai.module";
import { AlertsModule } from "./alerts/alerts.module";
import { AuthModule } from "./auth/auth.module";
import { PrismaModule } from "./prisma/prisma.module";
import { TelemetryModule } from "./telemetry/telemetry.module";
import { TripsModule } from "./trips/trips.module";
import { UsersModule } from "./users/users.module";
import { VehiclesModule } from "./vehicles/vehicles.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    VehiclesModule,
    TelemetryModule,
    TripsModule,
    AlertsModule,
    AiModule,
  ],
})
export class AppModule {}
