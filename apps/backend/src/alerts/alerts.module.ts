/** Módulo de alertas: reglas automáticas + consultas del usuario. */
import { Module } from "@nestjs/common";
import { AlertRulesService } from "./alert-rules.service";
import { AlertsController } from "./alerts.controller";
import { AlertsService } from "./alerts.service";

@Module({
  controllers: [AlertsController],
  providers: [AlertsService, AlertRulesService],
  exports: [AlertRulesService, AlertsService],
})
export class AlertsModule {}
