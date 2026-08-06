/** Servicio de dominio de autenticación: registro, login y emisión de JWT. */
import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { JwtPayload } from "./auth-user";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

/** Respuesta de autenticación con el token de acceso. */
export interface AuthResult {
  accessToken: string;
  user: { id: string; email: string; name: string };
}

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** Registra un usuario nuevo y devuelve directamente su token. */
  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException("Ya existe un usuario con ese email");
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash, name: dto.name },
    });
    return this.buildAuthResult(user.id, user.email, user.name);
  }

  /** Valida credenciales y devuelve el token de acceso. */
  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException("Credenciales inválidas");
    }
    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException("Credenciales inválidas");
    }
    return this.buildAuthResult(user.id, user.email, user.name);
  }

  private buildAuthResult(id: string, email: string, name: string): AuthResult {
    const payload: JwtPayload = { sub: id, email };
    return {
      accessToken: this.jwt.sign(payload),
      user: { id, email, name },
    };
  }
}
