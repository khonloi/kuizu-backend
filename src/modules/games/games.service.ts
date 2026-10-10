import { Injectable, Logger, Optional } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import {
  GameStateStore,
  PlayerState,
  LiveGameSession,
} from './game-state.store';
import { QuizzesService } from '../quizzes/quizzes.service';
import { QuizChoice } from '../quizzes/schemas/quiz.schema';
import { GameSessionRepository } from './repositories';
import { JobsProducerService } from '../jobs/jobs-producer.service';

export interface LeaderboardEntry {
  socketId: string;
  nickname: string;
  score: number;
  streak: number;
  lastAnswerScore: number;
}

export interface GameQuestionPayload {
  questionIndex: number;
  totalQuestions: number;
  questionText: string;
  timeLimit: number;
  points: number;
  mediaUrl: string;
  choices: {
    id: string;
    text: string;
    color: string;
  }[];
}

export type JoinGameResult =
  | { success: false; message: string }
  | {
      success: true;
      pin: string;
      player: PlayerState;
      session: LiveGameSession;
      nickname: string;
      quizTitle: string;
      totalQuestions: number;
      playerCount: number;
    };

export type StartGameResult =
  | { success: false; message: string }
  | {
      success: true;
      pin: string;
      questionIndex: number;
      payload: GameQuestionPayload;
    };

export type NextQuestionResult =
  | { success: false; message: string }
  | {
      success: true;
      isFinished: true;
      pin: string;
      podium: LeaderboardEntry[];
      finalLeaderboard: LeaderboardEntry[];
    }
  | {
      success: true;
      isFinished: false;
      pin: string;
      questionIndex: number;
      payload: GameQuestionPayload;
    };

export type RevealQuestionResult =
  | { success: false; message: string }
  | {
      success: true;
      pin: string;
      payload: {
        correctChoiceId?: string;
        correctChoiceText?: string;
        leaderboard: LeaderboardEntry[];
      };
    };

@Injectable()
export class GamesService {
  private readonly logger = new Logger(GamesService.name);

  constructor(
    private readonly gameStateStore: GameStateStore,
    private readonly quizzesService: QuizzesService,
    private readonly jwtService: JwtService,
    private readonly gameSessionRepository: GameSessionRepository,
    @Optional() private readonly jobsProducerService?: JobsProducerService,
  ) {}

  authenticateToken(rawToken?: string): any {
    if (!rawToken) return null;
    try {
      const token = rawToken.startsWith('Bearer ')
        ? rawToken.slice(7).trim()
        : rawToken;
      return this.jwtService.verify(token);
    } catch {
      return null;
    }
  }

  handleDisconnect(socketId: string) {
    return this.gameStateStore.removeSocket(socketId);
  }

  async createGameSession(
    hostSocketId: string,
    quizId: string,
    hostUserId?: string,
  ) {
    const quiz = await this.quizzesService.findOne(quizId);
    if (!quiz.questions || quiz.questions.length === 0) {
      throw new Error('Quiz has no questions');
    }

    const session = this.gameStateStore.createSession(
      hostSocketId,
      quiz._id.toString(),
      quiz.title,
      quiz.questions,
      hostUserId,
    );

    this.logger.log(
      `Host created game session PIN: ${session.pin} for quiz: ${quiz.title}`,
    );

    return {
      pin: session.pin,
      quizTitle: quiz.title,
      totalQuestions: quiz.questions.length,
    };
  }

  joinGame(pin: string, socketId: string, nickname: string): JoinGameResult {
    const result = this.gameStateStore.addPlayer(pin, socketId, nickname);
    if (!result.success || !result.player) {
      return {
        success: false,
        message: result.message || 'Failed to join game',
      };
    }

    const session = this.gameStateStore.getSession(pin)!;
    return {
      success: true,
      pin,
      player: result.player,
      session,
      nickname: result.player.nickname,
      quizTitle: session.quizTitle,
      totalQuestions: session.questions.length,
      playerCount: session.players.size,
    };
  }

  startGame(hostSocketId: string): StartGameResult {
    const session = this.gameStateStore.getSessionByHost(hostSocketId);
    if (!session) {
      return { success: false, message: 'Session not found for host' };
    }

    return this.prepareQuestion(session, 0);
  }

  async nextQuestionOrFinish(
    hostSocketId: string,
  ): Promise<NextQuestionResult> {
    const session = this.gameStateStore.getSessionByHost(hostSocketId);
    if (!session) {
      return { success: false, message: 'Session not found for host' };
    }

    const nextIndex = session.currentQuestionIndex + 1;
    if (nextIndex >= session.questions.length) {
      const finishData = await this.finishGame(session);
      return {
        success: true,
        isFinished: true,
        pin: session.pin,
        podium: finishData.podium,
        finalLeaderboard: finishData.finalLeaderboard,
      };
    }

    const questionData = this.prepareQuestion(session, nextIndex);
    return {
      success: true,
      isFinished: false,
      pin: session.pin,
      questionIndex: questionData.questionIndex,
      payload: questionData.payload,
    };
  }

  prepareQuestion(session: LiveGameSession, questionIndex: number) {
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

    return {
      success: true as const,
      pin: session.pin,
      questionIndex,
      payload: {
        questionIndex,
        totalQuestions: session.questions.length,
        questionText: question.questionText,
        timeLimit: question.timeLimit,
        points: question.points,
        mediaUrl: question.mediaUrl,
        choices: playerChoices,
      },
    };
  }

  recordAnswer(pin: string, socketId: string, choiceId: string) {
    const result = this.gameStateStore.recordAnswer(pin, socketId, choiceId);
    let answeredCount = 0;
    let totalPlayers = 0;

    if (result.success) {
      const session = this.gameStateStore.getSession(pin);
      if (session) {
        answeredCount = Array.from(session.players.values()).filter(
          (p: PlayerState) => p.answeredCurrent,
        ).length;
        totalPlayers = session.players.size;
      }
    }

    return {
      ...result,
      answeredCount,
      totalPlayers,
    };
  }

  revealQuestion(hostSocketId: string): RevealQuestionResult {
    const session = this.gameStateStore.getSessionByHost(hostSocketId);
    if (!session || session.state !== 'question') {
      return { success: false, message: 'Invalid state for reveal' };
    }

    session.state = 'reveal';
    const currentQuestion = session.questions[session.currentQuestionIndex];
    const correctChoice = currentQuestion.choices.find(
      (c: QuizChoice) => c.isCorrect,
    );
    const leaderboard = this.gameStateStore.getLeaderboard(session.pin);

    return {
      success: true,
      pin: session.pin,
      payload: {
        correctChoiceId: correctChoice?.id,
        correctChoiceText: correctChoice?.text,
        leaderboard: leaderboard.slice(0, 5),
      },
    };
  }

  async finishGame(session: LiveGameSession) {
    session.state = 'ended';
    const finalLeaderboard = this.gameStateStore.getLeaderboard(session.pin);
    const podium = finalLeaderboard.slice(0, 3);

    const players = finalLeaderboard.map((p, idx) => ({
      nickname: p.nickname,
      score: p.score,
      rank: idx + 1,
    }));

    if (this.jobsProducerService) {
      void this.jobsProducerService
        .saveGameSessionReport({
          pin: session.pin,
          hostUserId: session.hostUserId,
          quizId: session.quizId,
          quizTitle: session.quizTitle,
          players,
        })
        .catch((err: Error) =>
          this.logger.error(
            `Failed to enqueue game session report: ${err.message}`,
          ),
        );
    } else {
      void this.quizzesService
        .incrementPlayCount(session.quizId)
        .catch(() => null);

      try {
        const hostObjectId =
          session.hostUserId && Types.ObjectId.isValid(session.hostUserId)
            ? new Types.ObjectId(session.hostUserId)
            : null;

        if (Types.ObjectId.isValid(session.quizId)) {
          void this.gameSessionRepository
            .create({
              pin: session.pin,
              host: hostObjectId,
              quiz: new Types.ObjectId(session.quizId),
              quizTitle: session.quizTitle,
              players,
              status: 'completed',
            })
            .catch((err: Error) =>
              this.logger.error('Failed to save game session history', err),
            );
        }
      } catch (err: any) {
        this.logger.error('Failed to save game session history', err);
      }
    }

    return {
      success: true,
      podium,
      finalLeaderboard,
    };
  }
}
