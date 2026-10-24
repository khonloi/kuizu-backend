import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Optional } from '@nestjs/common';
import { GamesService } from './games.service';
import { TokenService } from '../auth/services/token.service';
import {
  hostCreateSchema,
  playerJoinSchema,
  playerAnswerSchema,
  playerReconnectSchema,
  parseWsPayload,
} from './dto/ws-game.dto';
import { WsRateLimiter } from './utils/ws-rate-limiter';
import { getAllowedCorsOrigins } from '../../config/cors.util';

export type HostCreateResult =
  | { success: false; message: string }
  | {
      success: true;
      pin: string;
      quizTitle: string;
      totalQuestions: number;
    };

@WebSocketGateway({
  cors: {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) return callback(null, true);
      const isProd = process.env.NODE_ENV === 'production';
      const allowed = getAllowedCorsOrigins(
        process.env.CORS_ALLOWED_ORIGINS,
        process.env.CLIENT_URL,
        isProd,
      );
      if (allowed.includes(origin) || !isProd) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  },
})
export class GamesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GamesGateway.name);
  private readonly joinRateLimiter = new WsRateLimiter(5);

  constructor(
    private readonly gamesService: GamesService,
    @Optional() private readonly tokenService?: TokenService,
  ) {}

  private extractToken(client: Socket): string | undefined {
    if (client.handshake.auth?.token) {
      return String(client.handshake.auth.token);
    }
    const authHeader = client.handshake.headers?.authorization;
    if (authHeader) {
      return authHeader;
    }
    const cookieHeader = client.handshake.headers?.cookie;
    if (cookieHeader) {
      const match = /(?:^|;\s*)access_token=([^;]+)/.exec(cookieHeader);
      if (match) {
        return decodeURIComponent(match[1]);
      }
    }
    return undefined;
  }

  async handleConnection(client: Socket) {
    const rawToken = this.extractToken(client);

    const user = this.tokenService
      ? await this.tokenService.verifyAndValidateToken(rawToken)
      : this.gamesService.authenticateToken(rawToken);

    if (user) {
      client.data.user = user;
      this.logger.log(
        `Socket authenticated: ${client.id} (user: ${user.username || user.id})`,
      );
    } else {
      if (rawToken) {
        this.logger.log(
          `Socket connected with invalid/expired token: ${client.id}`,
        );
      } else {
        this.logger.log(`Socket connected as guest: ${client.id}`);
      }
    }
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Socket disconnected: ${client.id}`);
    this.joinRateLimiter.reset(client.id);
    const result = await this.gamesService.handleDisconnect(client.id);
    if (result.pin) {
      if (result.wasHost) {
        this.server.to(`game:${result.pin}`).emit('game:cancelled', {
          message: 'Host has disconnected',
        });
      } else {
        this.server.to(`host:${result.pin}`).emit('player:left', {
          nickname: result.nickname,
          socketId: client.id,
        });
      }
    }
  }

  @SubscribeMessage('host:create')
  async handleHostCreate(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawData: unknown,
  ): Promise<HostCreateResult> {
    const parsed = parseWsPayload(hostCreateSchema, rawData);
    if (!parsed.success) {
      return {
        success: false,
        message: parsed.error,
      };
    }
    const data = parsed.data;

    try {
      const hostUserId = client.data?.user?.id || client.data?.user?.sub;
      const res = await this.gamesService.createGameSession(
        client.id,
        data.quizId,
        hostUserId,
      );

      void client.join(`host:${res.pin}`);
      void client.join(`game:${res.pin}`);

      return {
        success: true,
        ...res,
      };
    } catch (err) {
      return { success: false, message: (err as Error).message };
    }
  }

  @SubscribeMessage('player:join')
  async handlePlayerJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawData: unknown,
  ) {
    if (this.joinRateLimiter.isBlocked(client.id)) {
      return {
        success: false,
        message: 'Too many failed join attempts. Please reconnect.',
      };
    }

    const parsed = parseWsPayload(playerJoinSchema, rawData);
    if (!parsed.success) {
      this.joinRateLimiter.recordFailure(client.id);
      return {
        success: false,
        message: parsed.error,
      };
    }
    const data = parsed.data;

    const res = await this.gamesService.joinGame(
      data.pin,
      client.id,
      data.nickname,
    );

    if (!res.success) {
      this.joinRateLimiter.recordFailure(client.id);
      return res;
    }

    // Reset failed counter on successful join
    this.joinRateLimiter.reset(client.id);
    void client.join(`game:${data.pin}`);

    this.server.to(`host:${data.pin}`).emit('player:joined', {
      nickname: res.nickname,
      socketId: client.id,
      playerCount: res.playerCount,
    });

    return {
      success: true,
      pin: res.pin,
      nickname: res.nickname,
      quizTitle: res.quizTitle,
      totalQuestions: res.totalQuestions,
    };
  }

  @SubscribeMessage('host:start')
  async handleHostStart(@ConnectedSocket() client: Socket) {
    const res = await this.gamesService.startGame(client.id);
    if (!res.success) {
      return res;
    }

    this.server.to(`game:${res.pin}`).emit('question:start', res.payload);
    return { success: true, questionIndex: res.questionIndex };
  }

  @SubscribeMessage('host:next')
  async handleHostNext(@ConnectedSocket() client: Socket) {
    const res = await this.gamesService.nextQuestionOrFinish(client.id);
    if (!res.success) {
      return res;
    }

    if (res.isFinished) {
      this.server.to(`game:${res.pin}`).emit('game:ended', {
        podium: res.podium,
        fullLeaderboard: res.finalLeaderboard,
      });
      return { success: true, podium: res.podium };
    }

    this.server.to(`game:${res.pin}`).emit('question:start', res.payload);
    return { success: true, questionIndex: res.questionIndex };
  }

  @SubscribeMessage('player:answer')
  async handlePlayerAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawData: unknown,
  ) {
    const parsed = parseWsPayload(playerAnswerSchema, rawData);
    if (!parsed.success) {
      return {
        success: false,
        isCorrect: false,
        pointsEarned: 0,
        newScore: 0,
        message: parsed.error,
      };
    }
    const data = parsed.data;

    const res = await this.gamesService.recordAnswer(
      data.pin,
      client.id,
      data.choiceId,
    );

    if (res.success && res.totalPlayers > 0) {
      this.server.to(`host:${data.pin}`).emit('question:answer_count', {
        answeredCount: res.answeredCount,
        totalPlayers: res.totalPlayers,
      });

      if (res.answeredCount === res.totalPlayers) {
        this.server.to(`host:${data.pin}`).emit('question:all_answered', {
          pin: data.pin,
          answeredCount: res.answeredCount,
          totalPlayers: res.totalPlayers,
        });
      }
    }

    return res;
  }

  @SubscribeMessage('player:reconnect')
  async handlePlayerReconnect(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawData: unknown,
  ) {
    const parsed = parseWsPayload(playerReconnectSchema, rawData);
    if (!parsed.success) {
      return {
        success: false,
        message: parsed.error,
      };
    }
    const data = parsed.data;

    const res = await this.gamesService.reconnectPlayer(
      data.pin,
      client.id,
      data.nickname,
    );

    if (!res.success) {
      return res;
    }

    void client.join(`game:${data.pin}`);

    this.server.to(`host:${data.pin}`).emit('player:reconnected', {
      nickname: res.nickname,
      socketId: client.id,
    });

    return res;
  }

  @SubscribeMessage('host:reveal')
  async handleHostReveal(@ConnectedSocket() client: Socket) {
    const res = await this.gamesService.revealQuestion(client.id);
    if (!res.success) {
      return res;
    }

    this.server.to(`game:${res.pin}`).emit('question:reveal', res.payload);
    return { success: true };
  }
}
