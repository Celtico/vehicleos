/** DTO de POST /ai/ask. */
import {
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class AskDto {
  /** Pregunta del usuario sobre su coche. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  question!: string;

  /** Telemetría real del coche (opcional). */
  @IsOptional()
  @IsObject()
  telemetry?: Record<string, unknown>;

  /** DTCs activos (opcional). */
  @IsOptional()
  @IsArray()
  dtc?: Array<Record<string, unknown>>;
}
