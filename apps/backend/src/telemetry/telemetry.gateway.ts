/**
 * Gateway WebSocket de telemetría (socket.io, namespace /telemetry).
 *
 * Flujo:
 *  - El cliente se conecta con su JWT en `auth.token` (o `?token=` en query).
 *  - El coche/simulador emite "batch" (TelemetryBatch), "trip-start" y "trip-end".
 *  - El panel emite "watch" { vehicleId } para unirse a la sala del vehículo
 *    y recibe "live" con cada lote entrante y "alert" con cada alerta nueva.
 *  - Cada "batch" se confirma con "ack" { received }. Sin polling.
 */
import { Logger, HttpException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { TelemetryBatch, TelemetryServerMessage } from "@vehicleos/shared";
import type { Namespace, Socket } from "socket.io";
import { rowToAlert } from "../alerts/alerts.service";
import { socketIoPath } from "../api-prefix";
import { corsCredentials, corsOrigin } from "../cors";
import { JwtPayload } from "../auth/auth-user";
import { VehiclesService } from "../vehicles/vehicles.service";
import { TripsService } from "../trips/trips.service";
import { TelemetryIngestService } from "./telemetry-ingest.service";

/** Nombre de la sala socket.io de un vehículo. */
function vehicleRoom(vehicleId: string): string {
  return `vehicle:${vehicleId}`;
}

@WebSocketGateway({
  namespace: "/telemetry",
  // Acompaña al prefijo de la API: tras un proxy que sirve todo bajo /api,
  // socket.io queda en /api/socket.io y el cliente usa esa misma ruta.
  path: socketIoPath(),
  cors: { origin: corsOrigin(), credentials: corsCredentials() },
})
export class TelemetryGateway implements OnGatewayConnection {
  private readonly logger = new Logger(TelemetryGateway.name);

  @WebSocketServer()
  server!: Namespace;

  constructor(
    private readonly jwt: JwtService,
    private readonly ingest: TelemetryIngestService,
    private readonly trips: TripsService,
    private readonly vehicles: VehiclesService,
  ) {}

  /** Autenticación del handshake: sin JWT válido no hay conexión. */
  handleConnection(client: Socket): void {
    try {
      const token = this.extractToken(client);
      if (!token) {
        throw new Error("Falta el token");
      }
      const payload = this.jwt.verify<JwtPayload>(token);
      client.data.userId = payload.sub;
    } catch {
      this.logger.warn(`Conexión WS rechazada (${client.id}): token inválido`);
      client.emit("error", { message: "Token inválido o ausente" });
      client.disconnect(true);
    }
  }

  /** Lote de telemetría del vehículo → persistir + reglas + difusión "live". */
  @SubscribeMessage("batch")
  async onBatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() batch: TelemetryBatch,
  ): Promise<void> {
    const userId = this.userIdOf(client);
    try {
      const result = await this.ingest.ingestBatch(userId, batch);

      // Difusión en tiempo real a los observadores del vehículo (panel/mapa).
      // Se excluye al emisor: ya tiene esos datos y reenviárselos gasta
      // batería y ancho de banda del coche para nada.
      client.broadcast.to(vehicleRoom(batch.vehicleId)).emit("live", {
        vehicleId: batch.vehicleId,
        samples: batch.samples,
        ...(batch.dtc !== undefined ? { dtc: batch.dtc } : {}),
      });

      // Alertas nuevas: exactamente UNA por cliente y con la misma forma.
      // El emisor puede estar dentro de la sala (si hizo "watch"), así que
      // se difunde excluyéndolo y se le envía a él aparte.
      for (const alert of result.alerts) {
        const payload = rowToAlert(alert);
        client.broadcast.to(vehicleRoom(alert.vehicleId)).emit("alert", payload);
        client.emit("alert", payload);
      }

      // Confirmación al emisor.
      const ack: TelemetryServerMessage = {
        type: "ack",
        payload: { received: result.received },
      };
      client.emit("ack", ack.payload);
    } catch (error) {
      this.emitError(client, error);
    }
  }

  /** Inicio de viaje. */
  @SubscribeMessage("trip-start")
  async onTripStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { vehicleId: string; startedAt: number },
  ): Promise<void> {
    const userId = this.userIdOf(client);
    try {
      const trip = await this.trips.startTrip(userId, payload.vehicleId, payload.startedAt);
      // Una sola notificación por cliente (el emisor puede estar en la sala).
      client.broadcast.to(vehicleRoom(payload.vehicleId)).emit("trip-started", trip);
      client.emit("trip-started", trip);
    } catch (error) {
      this.emitError(client, error);
    }
  }

  /** Fin de viaje: cierra el viaje abierto y calcula agregados. */
  @SubscribeMessage("trip-end")
  async onTripEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { vehicleId: string; endedAt: number },
  ): Promise<void> {
    const userId = this.userIdOf(client);
    try {
      const trip = await this.trips.endTrip(userId, payload.vehicleId, payload.endedAt);
      // Una sola notificación por cliente (el emisor puede estar en la sala).
      client.broadcast.to(vehicleRoom(payload.vehicleId)).emit("trip-ended", trip);
      client.emit("trip-ended", trip);
    } catch (error) {
      this.emitError(client, error);
    }
  }

  /**
   * El panel se suscribe a la sala de un vehículo para recibir "live".
   * Solo el propietario puede observar su vehículo.
   */
  @SubscribeMessage("watch")
  async onWatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { vehicleId: string },
  ): Promise<void> {
    const userId = this.userIdOf(client);
    try {
      await this.vehicles.assertOwnership(payload.vehicleId, userId);
      await client.join(vehicleRoom(payload.vehicleId));
      client.emit("watching", { vehicleId: payload.vehicleId });
    } catch (error) {
      this.emitError(client, error);
    }
  }

  /** Token del handshake: auth.token o ?token= en la query. */
  private extractToken(client: Socket): string | null {
    const authToken = (client.handshake.auth as Record<string, unknown>)?.token;
    if (typeof authToken === "string" && authToken.length > 0) {
      return authToken;
    }
    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === "string" && queryToken.length > 0) {
      return queryToken;
    }
    return null;
  }

  private userIdOf(client: Socket): string {
    return client.data.userId as string;
  }

  /** Normaliza errores de dominio a un evento "error" del socket. */
  private emitError(client: Socket, error: unknown): void {
    const message =
      error instanceof HttpException ? error.message : "Error interno procesando el mensaje";
    if (!(error instanceof HttpException)) {
      this.logger.error(`Error en el gateway: ${String(error)}`);
    }
    client.emit("error", { message });
  }
}
