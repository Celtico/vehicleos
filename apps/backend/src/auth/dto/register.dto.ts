/** DTO de registro de usuario. */
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";

export class RegisterDto {
  @IsEmail({}, { message: "El email no es válido" })
  email!: string;

  @IsString()
  @MinLength(8, { message: "La contraseña debe tener al menos 8 caracteres" })
  @MaxLength(72)
  password!: string;

  @IsString()
  @IsNotEmpty({ message: "El nombre es obligatorio" })
  @MaxLength(120)
  name!: string;
}
