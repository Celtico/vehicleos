/**
 * Servicio inyectable de Prisma.
 * Extiende PrismaClient para poder usarse directamente (prisma.user.findMany, ...).
 */
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
    } catch (error) {
      // No tiramos la app en desarrollo: Prisma reintenta conectar de forma
      // perezosa en la primera consulta.
      this.logger.warn(`No se pudo conectar a la base de datos todavía: ${String(error)}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
