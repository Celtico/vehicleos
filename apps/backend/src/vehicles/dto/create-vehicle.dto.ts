/** DTO de creación de vehículo. */
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class CreateVehicleDto {
  /** Nombre "amistoso" del coche, p. ej. "El familiar". */
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  make!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  model!: string;

  @IsInt()
  @Min(1900)
  @Max(2100)
  year!: number;

  /** Número de bastidor (opcional). */
  @IsOptional()
  @IsString()
  @MaxLength(17)
  vin?: string;

  /** Matrícula (opcional). */
  @IsOptional()
  @IsString()
  @MaxLength(16)
  plate?: string;
}
