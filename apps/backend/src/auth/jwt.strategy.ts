/** Estrategia passport-jwt: valida el token Bearer con el secreto de entorno. */
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AuthUser, JwtPayload } from "./auth-user";

/** Secreto de emergencia SOLO para desarrollo local sin .env. */
export const DEV_JWT_SECRET = "vehicleos-secreto-solo-desarrollo";

/** Resuelve el secreto JWT desde el entorno (con aviso si falta). */
export function resolveJwtSecret(config: ConfigService): string {
  const secret = config.get<string>("JWT_SECRET");
  if (!secret) {
    Logger.warn(
      "JWT_SECRET no definido: usando secreto de desarrollo. NO usar en producción.",
      "AuthModule",
    );
    return DEV_JWT_SECRET;
  }
  return secret;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(config),
    });
  }

  /** Lo que devuelve aquí queda disponible como `request.user`. */
  validate(payload: JwtPayload): AuthUser {
    return { userId: payload.sub, email: payload.email };
  }
}
