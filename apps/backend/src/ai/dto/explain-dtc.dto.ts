/** DTO de POST /ai/dtc. */
import { IsObject, IsOptional, IsString, Matches } from "class-validator";

export class ExplainDtcDto {
  /** Código de avería OBD-II, p. ej. "P0401". */
  @IsString()
  @Matches(/^[PCBUpcbu][0-9A-Fa-f]{4}$/, {
    message: "El código debe tener el formato OBD-II, p. ej. P0401",
  })
  code!: string;

  /** Telemetría real del coche para contextualizar el diagnóstico (opcional). */
  @IsOptional()
  @IsObject()
  telemetry?: Record<string, unknown>;
}
