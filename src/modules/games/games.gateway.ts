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
import { GamesService } from './games.service';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class GamesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GamesGateway.name);

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
    @MessageBody() data: { quizId: string },
  ) {
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
    @MessageBody() data: { pin: string; nickname: string },
  ) {
    const res = this.gamesService.joinGame(data.pin, client.id, data.nickname);

    if (!res.success) {
      return res;
    }

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
    @MessageBody() data: { pin: string; choiceId: string },
  ) {
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
    }

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
