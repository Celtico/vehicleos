/** Servicio de dominio de usuarios. */
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/** Perfil público del usuario (sin hash de contraseña). */
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  createdAt: number;
  vehicleCount: number;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Devuelve el perfil del usuario autenticado. */
  async me(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { _count: { select: { vehicles: true } } },
    });
    if (!user) {
      throw new NotFoundException("Usuario no encontrado");
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.getTime(),
      vehicleCount: user._count.vehicles,
    };
  }
}
