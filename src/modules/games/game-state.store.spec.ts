import { describe, it, expect, beforeEach } from 'vitest';
import { GameStateStore } from './game-state.store';
import { QuizQuestion } from '../quizzes/schemas/quiz.schema';

describe('GameStateStore', () => {
  let store: GameStateStore;

  const mockQuestions: QuizQuestion[] = [
    {
      id: 'q1',
      questionText: 'Capital of France?',
      type: 'multiple-choice',
      timeLimit: 20,
      points: 1000,
      mediaUrl: '',
      choices: [
        { id: 'c1', text: 'Paris', isCorrect: true, color: 'blue' },
        { id: 'c2', text: 'London', isCorrect: false, color: 'red' },
      ],
    } as any,
  ];

  beforeEach(() => {
    store = new GameStateStore();
  });

  it('generatePin should return a 6-digit string', () => {
    const pin = store.generatePin();
    expect(pin).toMatch(/^\d{6}$/);
  });

  it('createSession should initialize a session in lobby state', () => {
    const session = store.createSession(
      'host-1',
      'quiz-1',
      'Geography',
      mockQuestions,
      'user-1',
    );
    expect(session.pin).toBeDefined();
    expect(session.hostSocketId).toBe('host-1');
    expect(session.hostUserId).toBe('user-1');
    expect(session.quizTitle).toBe('Geography');
    expect(session.state).toBe('lobby');
    expect(session.currentQuestionIndex).toBe(-1);
    expect(session.players.size).toBe(0);

    expect(store.getSession(session.pin)).toBe(session);
    expect(store.getSessionByHost('host-1')).toBe(session);
  });

  describe('addPlayer', () => {
    it('should fail if PIN does not exist', () => {
      const res = store.addPlayer('000000', 'p1', 'Alice');
      expect(res.success).toBe(false);
      expect(res.message).toBe('Game PIN not found');
    });

    it('should successfully add a player in lobby state', () => {
      const session = store.createSession(
        'host-1',
        'quiz-1',
        'Geo',
        mockQuestions,
      );
      const res = store.addPlayer(session.pin, 'p1', 'Alice');

      expect(res.success).toBe(true);
      expect(res.player?.nickname).toBe('Alice');
      expect(session.players.get('p1')).toBeDefined();
    });

    it('should reject duplicate nicknames case-insensitively', () => {
      const session = store.createSession(
        'host-1',
        'quiz-1',
        'Geo',
        mockQuestions,
      );
      store.addPlayer(session.pin, 'p1', 'Alice');
      const res = store.addPlayer(session.pin, 'p2', ' alice ');

      expect(res.success).toBe(false);
      expect(res.message).toBe('Nickname already taken in this room');
    });

    it('should fail if game has already started', () => {
      const session = store.createSession(
        'host-1',
        'quiz-1',
        'Geo',
        mockQuestions,
      );
      session.state = 'question';

      const res = store.addPlayer(session.pin, 'p1', 'Alice');
      expect(res.success).toBe(false);
      expect(res.message).toBe('Game has already started');
    });
  });

  describe('recordAnswer & getLeaderboard', () => {
    it('should award points for correct answers and track streaks', () => {
      const session = store.createSession(
        'host-1',
        'quiz-1',
        'Geo',
        mockQuestions,
      );
      store.addPlayer(session.pin, 'p1', 'Alice');
      store.addPlayer(session.pin, 'p2', 'Bob');

      session.state = 'question';
      session.currentQuestionIndex = 0;
      session.questionStartTime = Date.now();

      // Alice answers correctly
      const aliceAns = store.recordAnswer(session.pin, 'p1', 'c1');
      expect(aliceAns.success).toBe(true);
      expect(aliceAns.isCorrect).toBe(true);
      expect(aliceAns.pointsEarned).toBeGreaterThan(500);

      // Bob answers incorrectly
      const bobAns = store.recordAnswer(session.pin, 'p2', 'c2');
      expect(bobAns.success).toBe(true);
      expect(bobAns.isCorrect).toBe(false);
      expect(bobAns.pointsEarned).toBe(0);

      // Alice tries answering again in same question
      const dupAns = store.recordAnswer(session.pin, 'p1', 'c1');
      expect(dupAns.success).toBe(false);

      const leaderboard = store.getLeaderboard(session.pin);
      expect(leaderboard[0].nickname).toBe('Alice');
      expect(leaderboard[1].nickname).toBe('Bob');
      expect(leaderboard[0].streak).toBe(1);
      expect(leaderboard[1].streak).toBe(0);
    });
  });

  describe('removeSocket', () => {
    it('should delete session if host disconnects', () => {
      const session = store.createSession(
        'host-1',
        'quiz-1',
        'Geo',
        mockQuestions,
      );
      const res = store.removeSocket('host-1');

      expect(res.wasHost).toBe(true);
      expect(res.pin).toBe(session.pin);
      expect(store.getSession(session.pin)).toBeUndefined();
    });

    it('should remove player if a player disconnects', () => {
      const session = store.createSession(
        'host-1',
        'quiz-1',
        'Geo',
        mockQuestions,
      );
      store.addPlayer(session.pin, 'p1', 'Alice');

      const res = store.removeSocket('p1');
      expect(res.wasHost).toBe(false);
      expect(res.nickname).toBe('Alice');
      expect(session.players.has('p1')).toBe(false);
    });
  });
});
