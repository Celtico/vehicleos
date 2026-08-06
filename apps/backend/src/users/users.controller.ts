/** Endpoints de usuario (requieren JWT). */
import { Controller, Get, UseGuards } from "@nestjs/common";
import { AuthUser } from "../auth/auth-user";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { UserProfile, UsersService } from "./users.service";

@Controller("users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** GET /users/me — perfil del usuario del token. */
  @Get("me")
  me(@CurrentUser() user: AuthUser): Promise<UserProfile> {
    return this.users.me(user.userId);
  }
}
