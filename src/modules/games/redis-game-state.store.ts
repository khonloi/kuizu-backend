import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service';
import {
  IGameStateStore,
  LiveGameSession,
  PlayerState,
} from './game-state.store';
import { QuizChoice, QuizQuestion } from '../quizzes/schemas/quiz.schema';
import { randomInt } from 'node:crypto';

interface SerializedGameSession {
  pin: string;
  hostSocketId: string;
  hostUserId?: string;
  quizId: string;
  quizTitle: string;
  questions: QuizQuestion[];
  currentQuestionIndex: number;
  state: 'lobby' | 'question' | 'reveal' | 'ended';
  questionStartTime: number;
  players: [string, PlayerState][];
  disconnectedPlayers?: [string, PlayerState][];
  createdAt: number;
  lastActivityAt: number;
}

@Injectable()
export class RedisGameStateStore implements IGameStateStore {
  private readonly redisLogger = new Logger(RedisGameStateStore.name);
  private readonly SESSION_TTL_SECONDS = 7200; // 2 hours

  constructor(private readonly redisService: RedisService) {}

  private serialize(session: LiveGameSession): SerializedGameSession {
    return {
      pin: session.pin,
      hostSocketId: session.hostSocketId,
      hostUserId: session.hostUserId,
      quizId: session.quizId,
      quizTitle: session.quizTitle,
      questions: session.questions,
      currentQuestionIndex: session.currentQuestionIndex,
      state: session.state,
      questionStartTime: session.questionStartTime,
      players: Array.from(session.players.entries()),
      disconnectedPlayers: session.disconnectedPlayers
        ? Array.from(session.disconnectedPlayers.entries())
        : [],
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
    };
  }

  private deserialize(raw: SerializedGameSession): LiveGameSession {
    return {
      pin: raw.pin,
      hostSocketId: raw.hostSocketId,
      hostUserId: raw.hostUserId,
      quizId: raw.quizId,
      quizTitle: raw.quizTitle,
      questions: raw.questions,
      currentQuestionIndex: raw.currentQuestionIndex,
      state: raw.state,
      questionStartTime: raw.questionStartTime,
      players: new Map(raw.players),
      disconnectedPlayers: new Map(raw.disconnectedPlayers || []),
      createdAt: raw.createdAt,
      lastActivityAt: raw.lastActivityAt,
    };
  }

  async generatePin(): Promise<string> {
    let pin = '';
    let exists = true;
    let attempts = 0;
    while (exists && attempts < 10) {
      pin = randomInt(100000, 1000000).toString();
      exists = await this.redisService.exists(`game:session:${pin}`);
      attempts++;
    }
    return pin;
  }

  async createSession(
    hostSocketId: string,
    quizId: string,
    quizTitle: string,
    questions: QuizQuestion[],
    hostUserId?: string,
  ): Promise<LiveGameSession> {
    const pin = await this.generatePin();
    const now = Date.now();
    const session: LiveGameSession = {
      pin,
      hostSocketId,
      hostUserId,
      quizId,
      quizTitle,
      questions,
      currentQuestionIndex: -1,
      state: 'lobby',
      questionStartTime: 0,
      players: new Map(),
      disconnectedPlayers: new Map(),
      createdAt: now,
      lastActivityAt: now,
    };

    await this.redisService.set(
      `game:session:${pin}`,
      this.serialize(session),
      this.SESSION_TTL_SECONDS,
    );
    await this.redisService.set(
      `game:host:${hostSocketId}`,
      pin,
      this.SESSION_TTL_SECONDS,
    );

    return session;
  }

  async getSession(pin: string): Promise<LiveGameSession | undefined> {
    const raw = await this.redisService.get<SerializedGameSession>(
      `game:session:${pin}`,
    );
    if (!raw) return undefined;
    return this.deserialize(raw);
  }

  async getSessionByHost(
    hostSocketId: string,
  ): Promise<LiveGameSession | undefined> {
    const pin = await this.redisService.get<string>(
      `game:host:${hostSocketId}`,
    );
    if (!pin) return undefined;
    return this.getSession(pin);
  }

  private async withPinLock<R>(pin: string, fn: () => Promise<R>): Promise<R> {
    const lockKey = `lock:game:${pin}`;
    let attempts = 0;
    while (attempts < 15) {
      const acquired = await this.redisService.acquireLock(lockKey, 3000);
      if (acquired) {
        try {
          return await fn();
        } finally {
          await this.redisService.releaseLock(lockKey);
        }
      }
      attempts++;
      await new Promise((resolve) =>
        setTimeout(resolve, 20 + Math.random() * 30),
      );
    }
    return fn();
  }

  async addPlayer(
    pin: string,
    socketId: string,
    nickname: string,
  ): Promise<{ success: boolean; message?: string; player?: PlayerState }> {
    return this.withPinLock(pin, async () => {
      const session = await this.getSession(pin);
      if (!session) {
        return { success: false, message: 'Game PIN not found' };
      }
      if (session.state !== 'lobby') {
        return { success: false, message: 'Game has already started' };
      }

      const trimmedNickname = nickname.trim();
      for (const p of session.players.values()) {
        if (p.nickname.toLowerCase() === trimmedNickname.toLowerCase()) {
          return {
            success: false,
            message: 'Nickname already taken in this room',
          };
        }
      }

      const player: PlayerState = {
        socketId,
        nickname: trimmedNickname,
        score: 0,
        streak: 0,
        answeredCurrent: false,
        lastAnswerScore: 0,
        isConnected: true,
      };

      session.players.set(socketId, player);
      session.lastActivityAt = Date.now();

      await this.redisService.set(
        `game:session:${pin}`,
        this.serialize(session),
        this.SESSION_TTL_SECONDS,
      );
      await this.redisService.set(
        `game:socket:${socketId}`,
        pin,
        this.SESSION_TTL_SECONDS,
      );

      return { success: true, player };
    });
  }

  async reconnectPlayer(
    pin: string,
    socketId: string,
    nickname: string,
  ): Promise<{ success: boolean; message?: string; player?: PlayerState }> {
    return this.withPinLock(pin, async () => {
      const session = await this.getSession(pin);
      if (!session) {
        return { success: false, message: 'Game PIN not found' };
      }
      if (session.state === 'ended') {
        return { success: false, message: 'Game has already ended' };
      }

      const targetNickname = nickname.trim().toLowerCase();

      // 1. Check disconnected players
      if (session.disconnectedPlayers?.has(targetNickname)) {
        const player = session.disconnectedPlayers.get(targetNickname)!;
        session.disconnectedPlayers.delete(targetNickname);
        player.socketId = socketId;
        player.isConnected = true;
        delete player.disconnectedAt;
        session.players.set(socketId, player);
        session.lastActivityAt = Date.now();

        await this.redisService.set(
          `game:session:${pin}`,
          this.serialize(session),
          this.SESSION_TTL_SECONDS,
        );
        await this.redisService.set(
          `game:socket:${socketId}`,
          pin,
          this.SESSION_TTL_SECONDS,
        );

        return { success: true, player };
      }

      // 2. Check active players (e.g. quick reconnection or reconnect on reload)
      for (const [oldSocketId, player] of session.players.entries()) {
        if (player.nickname.toLowerCase() === targetNickname) {
          session.players.delete(oldSocketId);
          player.socketId = socketId;
          player.isConnected = true;
          delete player.disconnectedAt;
          session.players.set(socketId, player);
          session.lastActivityAt = Date.now();

          await this.redisService.del(`game:socket:${oldSocketId}`);
          await this.redisService.set(
            `game:session:${pin}`,
            this.serialize(session),
            this.SESSION_TTL_SECONDS,
          );
          await this.redisService.set(
            `game:socket:${socketId}`,
            pin,
            this.SESSION_TTL_SECONDS,
          );

          return { success: true, player };
        }
      }

      return { success: false, message: 'Player not found in this game room' };
    });
  }

  async recordAnswer(
    pin: string,
    socketId: string,
    choiceId: string,
  ): Promise<{
    success: boolean;
    isCorrect: boolean;
    pointsEarned: number;
    newScore: number;
  }> {
    return this.withPinLock(pin, async () => {
      const session = await this.getSession(pin);
      if (!session || session.state !== 'question') {
        return {
          success: false,
          isCorrect: false,
          pointsEarned: 0,
          newScore: 0,
        };
      }

      // Atomic answer lock key to prevent race conditions / duplicate answering
      const lockKey = `game:answered:${pin}:${socketId}:${session.currentQuestionIndex}`;
      const alreadyAnswered = await this.redisService.exists(lockKey);
      if (alreadyAnswered) {
        const player = session.players.get(socketId);
        return {
          success: false,
          isCorrect: false,
          pointsEarned: 0,
          newScore: player?.score || 0,
        };
      }

      const player = session.players.get(socketId);
      if (!player || player.answeredCurrent) {
        return {
          success: false,
          isCorrect: false,
          pointsEarned: 0,
          newScore: player?.score || 0,
        };
      }

      // Acquire lock for this question
      await this.redisService.set(lockKey, '1', 60);

      const currentQuestion = session.questions[session.currentQuestionIndex];
      if (!currentQuestion) {
        return {
          success: false,
          isCorrect: false,
          pointsEarned: 0,
          newScore: 0,
        };
      }

      const selectedChoice = currentQuestion.choices.find(
        (c: QuizChoice) => c.id === choiceId,
      );
      const isCorrect = !!selectedChoice?.isCorrect;

      const timeLimitMs = (currentQuestion.timeLimit || 20) * 1000;
      const timeElapsed = Math.max(0, Date.now() - session.questionStartTime);

      // If answer submitted after time limit plus 1s grace, reject with 0 points
      if (session.questionStartTime > 0 && timeElapsed > timeLimitMs + 1000) {
        player.answeredCurrent = true;
        player.lastAnswerScore = 0;
        await this.redisService.set(
          `game:session:${pin}`,
          this.serialize(session),
          this.SESSION_TTL_SECONDS,
        );
        return {
          success: false,
          isCorrect: false,
          pointsEarned: 0,
          newScore: player.score,
        };
      }

      let pointsEarned = 0;
      if (isCorrect) {
        const timeRemainingRatio = Math.max(
          0,
          (timeLimitMs - timeElapsed) / timeLimitMs,
        );
        const basePoints = currentQuestion.points || 1000;
        const speedBonus = Math.round(basePoints * 0.5 * timeRemainingRatio);
        const streakBonus = Math.min(player.streak * 50, 250);
        pointsEarned = Math.round(basePoints * 0.5) + speedBonus + streakBonus;
        player.streak += 1;
      } else {
        player.streak = 0;
      }

      player.answeredCurrent = true;
      player.score += pointsEarned;
      player.lastAnswerScore = pointsEarned;
      session.lastActivityAt = Date.now();

      await this.redisService.set(
        `game:session:${pin}`,
        this.serialize(session),
        this.SESSION_TTL_SECONDS,
      );

      return {
        success: true,
        isCorrect,
        pointsEarned,
        newScore: player.score,
      };
    });
  }

  async getLeaderboard(pin: string) {
    const session = await this.getSession(pin);
    if (!session) return [];

    const allPlayers = [
      ...session.players.values(),
      ...(session.disconnectedPlayers?.values() || []),
    ];

    return allPlayers
      .map((p) => ({
        socketId: p.socketId,
        nickname: p.nickname,
        score: p.score,
        streak: p.streak,
        lastAnswerScore: p.lastAnswerScore,
      }))
      .sort((a, b) => b.score - a.score);
  }

  async removeSocket(socketId: string): Promise<{
    pin?: string;
    wasHost: boolean;
    nickname?: string;
  }> {
    const hostPin = await this.redisService.get<string>(
      `game:host:${socketId}`,
    );
    if (hostPin) {
      await this.redisService.del(`game:host:${socketId}`);
      await this.redisService.del(`game:session:${hostPin}`);
      return { pin: hostPin, wasHost: true };
    }

    const playerPin = await this.redisService.get<string>(
      `game:socket:${socketId}`,
    );
    if (playerPin) {
      await this.redisService.del(`game:socket:${socketId}`);
      const session = await this.getSession(playerPin);
      if (session && session.players.has(socketId)) {
        const player = session.players.get(socketId)!;
        session.players.delete(socketId);
        if (session.state !== 'lobby') {
          player.isConnected = false;
          player.disconnectedAt = Date.now();
          if (!session.disconnectedPlayers) {
            session.disconnectedPlayers = new Map();
          }
          session.disconnectedPlayers.set(
            player.nickname.toLowerCase(),
            player,
          );
        }
        session.lastActivityAt = Date.now();
        await this.redisService.set(
          `game:session:${playerPin}`,
          this.serialize(session),
          this.SESSION_TTL_SECONDS,
        );
        return { pin: playerPin, wasHost: false, nickname: player.nickname };
      }
    }

    return { wasHost: false };
  }

  async removeSession(pin: string): Promise<void> {
    const session = await this.getSession(pin);
    if (session) {
      await this.redisService.del(`game:host:${session.hostSocketId}`);
    }
    await this.redisService.del(`game:session:${pin}`);
  }

  cleanupInactiveSessions(): number {
    // Redis handles automatic expiration via TTL on keys
    return 0;
  }
}
