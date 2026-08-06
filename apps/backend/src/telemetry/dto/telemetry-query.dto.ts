/** DTO de consulta de series de telemetría (query params). */
import { Type } from "class-transformer";
import { IsInt, IsNumber, IsOptional, Max, Min } from "class-validator";

export class TelemetryQueryDto {
  /** Inicio del rango, epoch en milisegundos. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  from?: number;

  /** Fin del rango, epoch en milisegundos. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  to?: number;

  /** Máximo de puntos a devolver (por defecto 500, tope 5000). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  limit?: number;
}
