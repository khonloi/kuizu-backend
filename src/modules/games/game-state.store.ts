import { Injectable } from '@nestjs/common';
import { QuizChoice, QuizQuestion } from '../quizzes/schemas/quiz.schema';

export interface PlayerState {
  socketId: string;
  nickname: string;
  score: number;
  streak: number;
  answeredCurrent: boolean;
  lastAnswerScore: number;
}

export interface LiveGameSession {
  pin: string;
  hostSocketId: string;
  hostUserId?: string;
  quizId: string;
  quizTitle: string;
  questions: QuizQuestion[];
  currentQuestionIndex: number;
  state: 'lobby' | 'question' | 'reveal' | 'ended';
  questionStartTime: number;
  players: Map<string, PlayerState>; // keyed by socketId
}

@Injectable()
export class GameStateStore {
  private sessions = new Map<string, LiveGameSession>(); // PIN -> session
  private hostToPin = new Map<string, string>(); // hostSocketId -> PIN

  generatePin(): string {
    let pin = '';
    do {
      pin = Math.floor(100000 + Math.random() * 900000).toString();
    } while (this.sessions.has(pin));
    return pin;
  }

  createSession(
    hostSocketId: string,
    quizId: string,
    quizTitle: string,
    questions: QuizQuestion[],
    hostUserId?: string,
  ): LiveGameSession {
    const pin = this.generatePin();
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
    };
    this.sessions.set(pin, session);
    this.hostToPin.set(hostSocketId, pin);
    return session;
  }

  getSession(pin: string): LiveGameSession | undefined {
    return this.sessions.get(pin);
  }

  getSessionByHost(hostSocketId: string): LiveGameSession | undefined {
    const pin = this.hostToPin.get(hostSocketId);
    return pin ? this.sessions.get(pin) : undefined;
  }

  addPlayer(
    pin: string,
    socketId: string,
    nickname: string,
  ): { success: boolean; message?: string; player?: PlayerState } {
    const session = this.sessions.get(pin);
    if (!session) {
      return { success: false, message: 'Game PIN not found' };
    }
    if (session.state !== 'lobby') {
      return { success: false, message: 'Game has already started' };
    }

    // Check duplicate nickname
    for (const p of session.players.values()) {
      if (p.nickname.toLowerCase() === nickname.toLowerCase().trim()) {
        return {
          success: false,
          message: 'Nickname already taken in this room',
        };
      }
    }

    const player: PlayerState = {
      socketId,
      nickname: nickname.trim(),
      score: 0,
      streak: 0,
      answeredCurrent: false,
      lastAnswerScore: 0,
    };

    session.players.set(socketId, player);
    return { success: true, player };
  }

  recordAnswer(
    pin: string,
    socketId: string,
    choiceId: string,
  ): {
    success: boolean;
    isCorrect: boolean;
    pointsEarned: number;
    newScore: number;
  } {
    const session = this.sessions.get(pin);
    if (!session || session.state !== 'question') {
      return { success: false, isCorrect: false, pointsEarned: 0, newScore: 0 };
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

    const currentQuestion = session.questions[session.currentQuestionIndex];
    if (!currentQuestion) {
      return { success: false, isCorrect: false, pointsEarned: 0, newScore: 0 };
    }

    const selectedChoice = currentQuestion.choices.find(
      (c: QuizChoice) => c.id === choiceId,
    );
    const isCorrect = !!selectedChoice?.isCorrect;

    let pointsEarned = 0;
    if (isCorrect) {
      const timeLimitMs = (currentQuestion.timeLimit || 20) * 1000;
      const timeElapsed = Math.max(0, Date.now() - session.questionStartTime);
      const timeRemainingRatio = Math.max(
        0,
        (timeLimitMs - timeElapsed) / timeLimitMs,
      );

      // Kahoot speed formula: base 50% + up to 50% for fast response + streak bonus
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

    return {
      success: true,
      isCorrect,
      pointsEarned,
      newScore: player.score,
    };
  }

  getLeaderboard(pin: string) {
    const session = this.sessions.get(pin);
    if (!session) return [];

    return Array.from(session.players.values())
      .map((p) => ({
        socketId: p.socketId,
        nickname: p.nickname,
        score: p.score,
        streak: p.streak,
        lastAnswerScore: p.lastAnswerScore,
      }))
      .sort((a, b) => b.score - a.score);
  }

  removeSocket(socketId: string): {
    pin?: string;
    wasHost: boolean;
    nickname?: string;
  } {
    if (this.hostToPin.has(socketId)) {
      const pin = this.hostToPin.get(socketId)!;
      this.sessions.delete(pin);
      this.hostToPin.delete(socketId);
      return { pin, wasHost: true };
    }

    for (const [pin, session] of this.sessions.entries()) {
      if (session.players.has(socketId)) {
        const player = session.players.get(socketId);
        session.players.delete(socketId);
        return { pin, wasHost: false, nickname: player?.nickname };
      }
    }

    return { wasHost: false };
  }
}
