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
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { GamesService } from './games.service';

const hostCreateSchema = z.object({
  quizId: z.string().min(1, 'Quiz ID is required'),
});

const playerJoinSchema = z.object({
  pin: z.string().regex(/^\d{6}$/, 'PIN must be a 6-digit number'),
  nickname: z
    .string()
    .trim()
    .min(1, 'Nickname cannot be empty')
    .max(30, 'Nickname cannot exceed 30 characters'),
});

const playerAnswerSchema = z.object({
  pin: z.string().regex(/^\d{6}$/, 'PIN must be a 6-digit number'),
  choiceId: z.string().min(1, 'Choice ID is required'),
});

const playerReconnectSchema = z.object({
  pin: z.string().regex(/^\d{6}$/, 'PIN must be a 6-digit number'),
  nickname: z
    .string()
    .trim()
    .min(1, 'Nickname cannot be empty')
    .max(30, 'Nickname cannot exceed 30 characters'),
});

@WebSocketGateway({
  cors: {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) return callback(null, true);
      const allowed = process.env.CORS_ALLOWED_ORIGINS
        ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim())
        : [
            process.env.CLIENT_URL || 'http://localhost:3001',
            'http://localhost:3000',
            'http://localhost:3001',
          ];
      if (allowed.includes(origin) || process.env.NODE_ENV !== 'production') {
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
  private failedJoinAttempts = new Map<string, number>();

  constructor(private readonly gamesService: GamesService) {}

  handleConnection(client: Socket) {
    const rawToken =
      (client.handshake.auth?.token as string) ||
      (client.handshake.headers?.authorization as string);

    const user = this.gamesService.authenticateToken(rawToken);
    if (user) {
      client.data.user = user;
      this.logger.log(
        `Socket authenticated: ${client.id} (user: ${user.username || user.sub})`,
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

  handleDisconnect(client: Socket) {
    this.logger.log(`Socket disconnected: ${client.id}`);
    this.failedJoinAttempts.delete(client.id);
    const result = this.gamesService.handleDisconnect(client.id);
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
  ) {
    const parsed = hostCreateSchema.safeParse(rawData);
    if (!parsed.success) {
      return {
        success: false,
        message: parsed.error.issues[0]?.message || 'Invalid data',
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
  handlePlayerJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawData: unknown,
  ) {
    const failedCount = this.failedJoinAttempts.get(client.id) || 0;
    if (failedCount >= 5) {
      return {
        success: false,
        message: 'Too many failed join attempts. Please reconnect.',
      };
    }

    const parsed = playerJoinSchema.safeParse(rawData);
    if (!parsed.success) {
      this.failedJoinAttempts.set(client.id, failedCount + 1);
      return {
        success: false,
        message: parsed.error.issues[0]?.message || 'Invalid join parameters',
      };
    }
    const data = parsed.data;

    const res = this.gamesService.joinGame(data.pin, client.id, data.nickname);

    if (!res.success) {
      this.failedJoinAttempts.set(client.id, failedCount + 1);
      return res;
    }

    // Reset failed counter on successful join
    this.failedJoinAttempts.delete(client.id);
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
  handleHostStart(@ConnectedSocket() client: Socket) {
    const res = this.gamesService.startGame(client.id);
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
  handlePlayerAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawData: unknown,
  ) {
    const parsed = playerAnswerSchema.safeParse(rawData);
    if (!parsed.success) {
      return {
        success: false,
        isCorrect: false,
        pointsEarned: 0,
        newScore: 0,
        message: parsed.error.issues[0]?.message || 'Invalid answer data',
      };
    }
    const data = parsed.data;

    const res = this.gamesService.recordAnswer(
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
  handlePlayerReconnect(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawData: unknown,
  ) {
    const parsed = playerReconnectSchema.safeParse(rawData);
    if (!parsed.success) {
      return {
        success: false,
        message:
          parsed.error.issues[0]?.message || 'Invalid reconnect parameters',
      };
    }
    const data = parsed.data;

    const res = this.gamesService.reconnectPlayer(
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
  handleHostReveal(@ConnectedSocket() client: Socket) {
    const res = this.gamesService.revealQuestion(client.id);
    if (!res.success) {
      return res;
    }

    this.server.to(`game:${res.pin}`).emit('question:reveal', res.payload);
    return { success: true };
  }
}
