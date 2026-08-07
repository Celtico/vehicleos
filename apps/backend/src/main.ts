/**
 * Punto de entrada del backend de VehicleOS.
 * Levanta la API HTTP y el gateway WebSocket (socket.io) en el mismo puerto.
 */
import { ValidationPipe, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { apiPrefix } from "./api-prefix";
import { corsCredentials, corsOrigin } from "./cors";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Prefijo bajo el que cuelga toda la API. Vacío en desarrollo; "/api" al
  // desplegar en el mismo dominio que el cockpit.
  const prefijo = apiPrefix();
  if (prefijo) app.setGlobalPrefix(prefijo.slice(1));

  // CORS para el panel web en desarrollo.
  app.enableCors({ origin: corsOrigin(), credentials: corsCredentials() });

  // Validación global: descarta propiedades no declaradas en los DTOs
  // y convierte tipos primitivos (query params numéricos, etc.).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const config = app.get(ConfigService);
  const port = Number(config.get<string>("PORT") ?? 3001);
  await app.listen(port);
  Logger.log(
    `Backend de VehicleOS escuchando en http://localhost:${port}${prefijo}`,
    "Bootstrap",
  );
}

void bootstrap();
