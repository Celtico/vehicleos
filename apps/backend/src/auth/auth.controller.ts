/** Endpoints públicos de autenticación. */
import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { AuthResult, AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** POST /auth/register — alta de usuario. */
  @Post("register")
  register(@Body() dto: RegisterDto): Promise<AuthResult> {
    return this.auth.register(dto);
  }

  /** POST /auth/login — devuelve { accessToken }. */
  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<AuthResult> {
    return this.auth.login(dto);
  }
}
