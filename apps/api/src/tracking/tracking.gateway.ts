import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { payloadToUser, type AccessTokenPayload } from '../common/guards/jwt-auth.guard';
import { RealtimeService, ROOMS } from '../realtime/realtime.service';
import { PositionsStore } from './positions.store';

/**
 * Socket.IO gateway. Clients authenticate with the same short-lived JWT used for REST
 * (`io(url, { auth: { token } })`) and are placed into rooms by role.
 */
@WebSocketGateway()
export class TrackingGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(TrackingGateway.name);
  @WebSocketServer() server: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly realtime: RealtimeService,
    private readonly positions: PositionsStore,
  ) {}

  afterInit(server: Server) {
    this.realtime.attach(server);

    // Authenticate during the handshake: a bad/expired token surfaces on the client as a
    // `connect_error` ("Unauthorized") instead of a connect-then-kick, so it can refresh
    // its access token and retry cleanly.
    server.use(async (socket, next) => {
      const token = socket.handshake.auth?.token as string | undefined;
      try {
        if (!token) throw new Error('missing token');
        socket.data.user = payloadToUser(await this.jwt.verifyAsync<AccessTokenPayload>(token));
        next();
      } catch (err) {
        this.logger.debug(`Rejected socket ${socket.id}: ${(err as Error).message}`);
        next(new Error('Unauthorized'));
      }
    });
  }

  async handleConnection(client: Socket) {
    const user = client.data.user as ReturnType<typeof payloadToUser> | undefined;
    if (!user) {
      client.disconnect(true);
      return;
    }

    if (user.role === 'DRIVER') {
      if (user.driverId) await client.join(ROOMS.driver(user.driverId));
    } else {
      await client.join(ROOMS.OPS);
    }

    // Send an immediate snapshot so the map renders without waiting for the next tick
    const snapshot = await this.positions.all();
    client.emit(
      'fleet:positions',
      user.role === 'DRIVER' ? snapshot.filter((p) => p.driverId === user.driverId) : snapshot,
    );
  }
}
