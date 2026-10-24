import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { GamesGateway } from './games.gateway';
import { GamesService } from './games.service';
import { GameStateStore } from './game-state.store';
import { QuizzesService } from '../quizzes/quizzes.service';

describe('GamesGateway', () => {
  let gateway: GamesGateway;
  let gamesService: GamesService;
  let mockGameStateStore: GameStateStore;
  let mockQuizzesService: QuizzesService;
  let mockJwtService: any;
  let mockGameSessionRepository: any;
  let mockServer: any;

  beforeEach(() => {
    mockGameStateStore = new GameStateStore();
    mockQuizzesService = {
      findOne: vi.fn(),
      incrementPlayCount: vi.fn().mockResolvedValue(undefined),
    } as unknown as QuizzesService;

    mockJwtService = {
      verify: vi.fn().mockReturnValue({ id: 'user-1', username: 'TeacherBob' }),
    };

    mockGameSessionRepository = {
      create: vi.fn().mockResolvedValue({}),
    };

    mockServer = {
      to: vi.fn().mockReturnValue({
        emit: vi.fn(),
      }),
    };

    gamesService = new GamesService(
      mockGameStateStore,
      mockQuizzesService,
      mockJwtService,
      mockGameSessionRepository,
    );

    gateway = new GamesGateway(gamesService);
    gateway.server = mockServer;
  });

  describe('handleConnection', () => {
    it('should authenticate client if valid Bearer token provided', async () => {
      const mockClient: any = {
        id: 'socket-1',
        data: {},
        handshake: {
          auth: { token: 'valid-token' },
          headers: {},
        },
      };

      await gateway.handleConnection(mockClient);
      expect(mockClient.data.user).toBeDefined();
      expect(mockClient.data.user.username).toBe('TeacherBob');
    });

    it('should allow connection without user data if no token provided', async () => {
      const mockClient: any = {
        id: 'socket-2',
        data: {},
        handshake: {
          auth: {},
          headers: {},
        },
      };

      await gateway.handleConnection(mockClient);
      expect(mockClient.data.user).toBeUndefined();
    });
  });

  describe('handleHostCreate', () => {
    it('should reject if quiz has no questions', async () => {
      const mockClient: any = { id: 'host-1', data: {}, join: vi.fn() };
      const quizId = new Types.ObjectId().toString();
      vi.spyOn(mockQuizzesService, 'findOne').mockResolvedValue({
        _id: quizId,
        title: 'Empty Quiz',
        questions: [],
      } as any);

      const res = await gateway.handleHostCreate(mockClient, { quizId });
      expect(res.success).toBe(false);
      if (res.success) throw new Error('Expected failure');
      expect(res.message).toBe('Quiz has no questions');
    });

    it('should create session and join rooms if quiz is valid', async () => {
      const mockClient: any = {
        id: 'host-1',
        data: { user: { id: new Types.ObjectId().toString() } },
        join: vi.fn(),
      };
      const quizId = new Types.ObjectId().toString();
      vi.spyOn(mockQuizzesService, 'findOne').mockResolvedValue({
        _id: quizId,
        title: 'Valid Quiz',
        questions: [{ id: 'q1', choices: [] }],
      } as any);

      const res = (await gateway.handleHostCreate(mockClient, {
        quizId,
      })) as any;
      expect(res.success).toBe(true);
      expect(res.quizTitle).toBe('Valid Quiz');
      expect(mockClient.join).toHaveBeenCalledWith(`host:${res.pin}`);
      expect(mockClient.join).toHaveBeenCalledWith(`game:${res.pin}`);
    });
  });

  describe('handlePlayerJoin & gameplay events', () => {
    it('should allow player to join and handle answers', async () => {
      const hostUserId = new Types.ObjectId().toString();
      const hostClient: any = {
        id: 'host-1',
        data: { user: { id: hostUserId } },
        join: vi.fn(),
      };
      const quizId = new Types.ObjectId().toString();
      vi.spyOn(mockQuizzesService, 'findOne').mockResolvedValue({
        _id: quizId,
        title: 'Trivia',
        questions: [
          {
            id: 'q1',
            questionText: 'Q1?',
            timeLimit: 20,
            points: 1000,
            choices: [
              { id: 'c1', text: 'Correct', isCorrect: true, color: 'blue' },
              { id: 'c2', text: 'Wrong', isCorrect: false, color: 'red' },
            ],
          },
        ],
      } as any);

      const createRes = (await gateway.handleHostCreate(hostClient, {
        quizId,
      })) as any;
      const pin = createRes.pin!;

      const playerClient: any = {
        id: 'player-1',
        join: vi.fn(),
      };

      const joinRes = await gateway.handlePlayerJoin(playerClient, {
        pin,
        nickname: 'Gamer',
      });
      expect(joinRes.success).toBe(true);
      expect(playerClient.join).toHaveBeenCalledWith(`game:${pin}`);

      // Host starts game
      await gateway.handleHostStart(hostClient);
      const session = mockGameStateStore.getSession(pin)!;
      expect(session.state).toBe('question');

      // Player answers
      const ansRes = await gateway.handlePlayerAnswer(playerClient, {
        pin,
        choiceId: 'c1',
      });
      expect(ansRes.success).toBe(true);
      expect(ansRes.isCorrect).toBe(true);

      // Host reveals
      const revealRes = await gateway.handleHostReveal(hostClient);
      expect(revealRes.success).toBe(true);
      expect(session.state).toBe('reveal');

      // Host moves to next (which completes game since only 1 question)
      const nextRes = await gateway.handleHostNext(hostClient);
      expect(nextRes.success).toBe(true);
      expect(session.state).toBe('ended');
      expect(mockGameSessionRepository.create).toHaveBeenCalled();

      // Subsequent host:next should fail safely since game already ended
      const endedNextRes = (await gateway.handleHostNext(hostClient)) as any;
      expect(endedNextRes.success).toBe(false);
      expect(endedNextRes.message).toBe('Game has already ended');
    });

    it('should reject invalid join payloads', async () => {
      const playerClient: any = { id: 'p-bad', join: vi.fn() };
      const res = await gateway.handlePlayerJoin(playerClient, {
        pin: 'invalid-pin',
        nickname: '',
      });
      expect(res.success).toBe(false);
    });

    it('should throttle player after 5 failed join attempts', async () => {
      const playerClient: any = { id: 'p-spammer', join: vi.fn() };
      for (let i = 0; i < 5; i++) {
        await gateway.handlePlayerJoin(playerClient, {
          pin: '999999',
          nickname: 'Attacker',
        });
      }
      const throttledRes = await gateway.handlePlayerJoin(playerClient, {
        pin: '999999',
        nickname: 'Attacker',
      });
      expect(throttledRes.success).toBe(false);
      expect(throttledRes.message).toContain('Too many failed join attempts');
    });

    it('should emit question:all_answered when all players have submitted answers', async () => {
      const hostClient: any = {
        id: 'host-1',
        data: { user: { id: new Types.ObjectId().toString() } },
        join: vi.fn(),
      };
      const quizId = new Types.ObjectId().toString();
      vi.spyOn(mockQuizzesService, 'findOne').mockResolvedValue({
        _id: quizId,
        title: 'Trivia',
        questions: [
          {
            id: 'q1',
            questionText: 'Q1',
            choices: [{ id: 'c1', text: 'Ans1', isCorrect: true }],
          },
        ],
      } as any);

      const createRes = await gateway.handleHostCreate(hostClient, { quizId });
      expect(createRes.success).toBe(true);
      if (!createRes.success) throw new Error('Host create failed');
      const pin = createRes.pin;

      const playerClient: any = { id: 'p1', join: vi.fn() };
      await gateway.handlePlayerJoin(playerClient, { pin, nickname: 'Alice' });

      await gateway.handleHostStart(hostClient);

      const hostEmitter = { emit: vi.fn() };
      mockServer.to.mockImplementation((room: string) => {
        if (room === `host:${pin}`) return hostEmitter;
        return { emit: vi.fn() };
      });

      await gateway.handlePlayerAnswer(playerClient, { pin, choiceId: 'c1' });

      expect(hostEmitter.emit).toHaveBeenCalledWith(
        'question:all_answered',
        expect.objectContaining({
          pin,
          answeredCount: 1,
          totalPlayers: 1,
        }),
      );
    });

    it('should handle player:reconnect and notify host room', async () => {
      const hostClient: any = {
        id: 'host-1',
        data: { user: { id: new Types.ObjectId().toString() } },
        join: vi.fn(),
      };
      const quizId = new Types.ObjectId().toString();
      vi.spyOn(mockQuizzesService, 'findOne').mockResolvedValue({
        _id: quizId,
        title: 'Trivia',
        questions: [
          {
            id: 'q1',
            questionText: 'Q1',
            choices: [{ id: 'c1', text: 'Ans1', isCorrect: true }],
          },
        ],
      } as any);

      const createRes = await gateway.handleHostCreate(hostClient, { quizId });
      expect(createRes.success).toBe(true);
      if (!createRes.success) throw new Error('Host create failed');
      const pin = createRes.pin;

      const playerClient1: any = { id: 'p1', join: vi.fn() };
      await gateway.handlePlayerJoin(playerClient1, { pin, nickname: 'Alice' });

      await gateway.handleHostStart(hostClient);

      // Player 1 disconnects
      await gateway.handleDisconnect(playerClient1);

      // Player 1 reconnects with new socket
      const hostEmitter = { emit: vi.fn() };
      mockServer.to.mockImplementation((room: string) => {
        if (room === `host:${pin}`) return hostEmitter;
        return { emit: vi.fn() };
      });

      const playerClient2: any = { id: 'p1-reconnected', join: vi.fn() };
      const reconnRes = await gateway.handlePlayerReconnect(playerClient2, {
        pin,
        nickname: 'Alice',
      });

      expect(reconnRes.success).toBe(true);
      expect(playerClient2.join).toHaveBeenCalledWith(`game:${pin}`);
      expect(hostEmitter.emit).toHaveBeenCalledWith('player:reconnected', {
        nickname: 'Alice',
        socketId: 'p1-reconnected',
      });
    });

    it('should reject invalid reconnect parameters', async () => {
      const playerClient: any = { id: 'p-invalid', join: vi.fn() };
      const res = await gateway.handlePlayerReconnect(playerClient, {
        pin: 'invalid',
        nickname: '',
      });
      expect(res.success).toBe(false);
    });
  });
});
