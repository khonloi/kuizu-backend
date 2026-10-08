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
import { GameStateStore, PlayerState, LiveGameSession } from './game-state.store';
import { QuizzesService } from '../quizzes/quizzes.service';
import { QuizChoice } from '../quizzes/schemas/quiz.schema';

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

  constructor(
    private readonly gameStateStore: GameStateStore,
    private readonly quizzesService: QuizzesService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Socket connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Socket disconnected: ${client.id}`);
    const result = this.gameStateStore.removeSocket(client.id);
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
      const quiz = await this.quizzesService.findOne(data.quizId);
      if (!quiz.questions || quiz.questions.length === 0) {
        return { success: false, message: 'Quiz has no questions' };
      }

      const session = this.gameStateStore.createSession(
        client.id,
        quiz._id.toString(),
        quiz.title,
        quiz.questions,
      );

      void client.join(`host:${session.pin}`);
      void client.join(`game:${session.pin}`);

      this.logger.log(`Host created game session PIN: ${session.pin} for quiz: ${quiz.title}`);

      return {
        success: true,
        pin: session.pin,
        quizTitle: quiz.title,
        totalQuestions: quiz.questions.length,
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
    const { pin, nickname } = data;
    const result = this.gameStateStore.addPlayer(pin, client.id, nickname);

    if (!result.success) {
      return result;
    }

    void client.join(`game:${pin}`);

    const session = this.gameStateStore.getSession(pin)!;

    this.server.to(`host:${pin}`).emit('player:joined', {
      nickname: result.player!.nickname,
      socketId: client.id,
      playerCount: session.players.size,
    });

    return {
      success: true,
      pin,
      nickname: result.player!.nickname,
      quizTitle: session.quizTitle,
      totalQuestions: session.questions.length,
    };
  }

  @SubscribeMessage('host:start')
  handleHostStart(@ConnectedSocket() client: Socket) {
    const session = this.gameStateStore.getSessionByHost(client.id);
    if (!session) {
      return { success: false, message: 'Session not found for host' };
    }

    return this.sendQuestion(session, 0);
  }

  @SubscribeMessage('host:next')
  handleHostNext(@ConnectedSocket() client: Socket) {
    const session = this.gameStateStore.getSessionByHost(client.id);
    if (!session) {
      return { success: false, message: 'Session not found for host' };
    }

    const nextIndex = session.currentQuestionIndex + 1;
    if (nextIndex >= session.questions.length) {
      return this.finishGame(session);
    }

    return this.sendQuestion(session, nextIndex);
  }

  private sendQuestion(session: LiveGameSession, questionIndex: number) {
    session.currentQuestionIndex = questionIndex;
    session.state = 'question';
    session.questionStartTime = Date.now();

    for (const player of session.players.values()) {
      player.answeredCurrent = false;
      player.lastAnswerScore = 0;
    }

    const question = session.questions[questionIndex];

    const playerChoices = question.choices.map((c: QuizChoice) => ({
      id: c.id,
      text: c.text,
      color: c.color,
    }));

    this.server.to(`game:${session.pin}`).emit('question:start', {
      questionIndex,
      totalQuestions: session.questions.length,
      questionText: question.questionText,
      timeLimit: question.timeLimit,
      points: question.points,
      mediaUrl: question.mediaUrl,
      choices: playerChoices,
    });

    return { success: true, questionIndex };
  }

  @SubscribeMessage('player:answer')
  handlePlayerAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pin: string; choiceId: string },
  ) {
    const { pin, choiceId } = data;
    const result = this.gameStateStore.recordAnswer(pin, client.id, choiceId);

    if (result.success) {
      const session = this.gameStateStore.getSession(pin);
      if (session) {
        const answeredCount = Array.from(session.players.values()).filter(
          (p: PlayerState) => p.answeredCurrent,
        ).length;

        this.server.to(`host:${pin}`).emit('question:answer_count', {
          answeredCount,
          totalPlayers: session.players.size,
        });
      }
    }

    return result;
  }

  @SubscribeMessage('host:reveal')
  handleHostReveal(@ConnectedSocket() client: Socket) {
    const session = this.gameStateStore.getSessionByHost(client.id);
    if (!session || session.state !== 'question') {
      return { success: false, message: 'Invalid state for reveal' };
    }

    session.state = 'reveal';
    const currentQuestion = session.questions[session.currentQuestionIndex];
    const correctChoice = currentQuestion.choices.find((c: QuizChoice) => c.isCorrect);

    const leaderboard = this.gameStateStore.getLeaderboard(session.pin);

    this.server.to(`game:${session.pin}`).emit('question:reveal', {
      correctChoiceId: correctChoice?.id,
      correctChoiceText: correctChoice?.text,
      leaderboard: leaderboard.slice(0, 5),
    });

    return { success: true };
  }

  private finishGame(session: LiveGameSession) {
    session.state = 'ended';
    const finalLeaderboard = this.gameStateStore.getLeaderboard(session.pin);
    const podium = finalLeaderboard.slice(0, 3);

    this.quizzesService.incrementPlayCount(session.quizId).catch(() => null);

    this.server.to(`game:${session.pin}`).emit('game:ended', {
      podium,
      fullLeaderboard: finalLeaderboard,
    });

    return { success: true, podium };
  }
}
