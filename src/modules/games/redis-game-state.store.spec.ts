import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RedisGameStateStore } from './redis-game-state.store';
import { RedisService } from '../../common/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { QuizQuestion } from '../quizzes/schemas/quiz.schema';

describe('RedisGameStateStore', () => {
  let store: RedisGameStateStore;
  let redisService: RedisService;
  let configService: ConfigService;

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
    configService = {
      get: vi.fn().mockReturnValue(undefined), // In-memory fallback mode
    } as unknown as ConfigService;
    redisService = new RedisService(configService);
    store = new RedisGameStateStore(redisService);
  });

  it('generatePin should return a 6-digit string', async () => {
    const pin = await store.generatePin();
    expect(pin).toMatch(/^\d{6}$/);
  });

  it('createSession should persist in Redis and retrieve session in lobby state', async () => {
    const session = await store.createSession(
      'host-1',
      'quiz-1',
      'Geography',
      mockQuestions,
      'user-1',
    );

    expect(session.pin).toBeDefined();
    expect(session.hostSocketId).toBe('host-1');
    expect(session.state).toBe('lobby');

    const retrieved = await store.getSession(session.pin);
    expect(retrieved).toBeDefined();
    expect(retrieved?.quizTitle).toBe('Geography');
    expect(retrieved?.players instanceof Map).toBe(true);

    const hostSession = await store.getSessionByHost('host-1');
    expect(hostSession?.pin).toBe(session.pin);
  });

  it('addPlayer should add player and save player socket mapping', async () => {
    const session = await store.createSession(
      'host-1',
      'quiz-1',
      'Geography',
      mockQuestions,
    );

    const joinResult = await store.addPlayer(
      session.pin,
      'sock-player-1',
      'Alice',
    );
    expect(joinResult.success).toBe(true);
    expect(joinResult.player?.nickname).toBe('Alice');

    // Reject duplicate nickname
    const dupResult = await store.addPlayer(
      session.pin,
      'sock-player-2',
      'alice',
    );
    expect(dupResult.success).toBe(false);
    expect(dupResult.message).toContain('already taken');

    const updatedSession = await store.getSession(session.pin);
    expect(updatedSession?.players.size).toBe(1);
    expect(updatedSession?.players.get('sock-player-1')?.nickname).toBe(
      'Alice',
    );
  });

  it('reconnectPlayer should reconnect player with new socketId', async () => {
    const session = await store.createSession(
      'host-1',
      'quiz-1',
      'Geography',
      mockQuestions,
    );

    await store.addPlayer(session.pin, 'sock-old', 'Bob');

    const reconnectResult = await store.reconnectPlayer(
      session.pin,
      'sock-new',
      'Bob',
    );
    expect(reconnectResult.success).toBe(true);
    expect(reconnectResult.player?.socketId).toBe('sock-new');

    const updatedSession = await store.getSession(session.pin);
    expect(updatedSession?.players.has('sock-new')).toBe(true);
    expect(updatedSession?.players.has('sock-old')).toBe(false);
  });

  it('recordAnswer should calculate score and prevent double scoring', async () => {
    const session = await store.createSession(
      'host-1',
      'quiz-1',
      'Geography',
      mockQuestions,
    );
    await store.addPlayer(session.pin, 'sock-p1', 'Charlie');

    const activeSession = (await store.getSession(session.pin))!;
    activeSession.state = 'question';
    activeSession.currentQuestionIndex = 0;
    activeSession.questionStartTime = Date.now();
    await redisService.set(
      `game:session:${session.pin}`,
      (store as any).serialize(activeSession),
    );

    // First answer submission
    const res1 = await store.recordAnswer(session.pin, 'sock-p1', 'c1');
    expect(res1.success).toBe(true);
    expect(res1.isCorrect).toBe(true);
    expect(res1.pointsEarned).toBeGreaterThan(0);

    // Second rapid answer submission from another replica / double click
    const res2 = await store.recordAnswer(session.pin, 'sock-p1', 'c1');
    expect(res2.success).toBe(false);
  });

  it('multi-instance distributed simulation: instance A creates, instance B reads and adds player', async () => {
    // Both instances share the same RedisService
    const instanceA = new RedisGameStateStore(redisService);
    const instanceB = new RedisGameStateStore(redisService);

    const sessionA = await instanceA.createSession(
      'host-inst-a',
      'quiz-dist',
      'Distributed Quiz',
      mockQuestions,
    );

    // Instance B reads the session created by Instance A
    const sessionB = await instanceB.getSession(sessionA.pin);
    expect(sessionB).toBeDefined();
    expect(sessionB?.quizTitle).toBe('Distributed Quiz');

    // Instance B adds player
    const joinResult = await instanceB.addPlayer(
      sessionA.pin,
      'sock-inst-b',
      'David',
    );
    expect(joinResult.success).toBe(true);

    // Instance A sees player added by Instance B
    const sessionAUpdated = await instanceA.getSession(sessionA.pin);
    expect(sessionAUpdated?.players.get('sock-inst-b')?.nickname).toBe('David');
  });

  it('removeSocket should clean up host or player properly', async () => {
    const session = await store.createSession(
      'host-disconnect',
      'quiz-1',
      'Geography',
      mockQuestions,
    );

    const disconnectRes = await store.removeSocket('host-disconnect');
    expect(disconnectRes.wasHost).toBe(true);
    expect(disconnectRes.pin).toBe(session.pin);

    const check = await store.getSession(session.pin);
    expect(check).toBeUndefined();
  });
});
