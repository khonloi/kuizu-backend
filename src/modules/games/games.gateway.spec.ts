import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { GamesGateway } from './games.gateway';
import { GameStateStore } from './game-state.store';
import { QuizzesService } from '../quizzes/quizzes.service';

describe('GamesGateway', () => {
  let gateway: GamesGateway;
  let mockGameStateStore: GameStateStore;
  let mockQuizzesService: QuizzesService;
  let mockJwtService: any;
  let mockGameSessionModel: any;
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

    mockGameSessionModel = {
      create: vi.fn().mockResolvedValue({}),
    };

    mockServer = {
      to: vi.fn().mockReturnValue({
        emit: vi.fn(),
      }),
    };

    gateway = new GamesGateway(
      mockGameStateStore,
      mockQuizzesService,
      mockJwtService,
      mockGameSessionModel,
    );
    gateway.server = mockServer;
  });

  describe('handleConnection', () => {
    it('should authenticate client if valid Bearer token provided', () => {
      const mockClient: any = {
        id: 'socket-1',
        data: {},
        handshake: {
          auth: { token: 'valid-token' },
          headers: {},
        },
      };

      gateway.handleConnection(mockClient);
      expect(mockClient.data.user).toBeDefined();
      expect(mockClient.data.user.username).toBe('TeacherBob');
    });

    it('should allow connection without user data if no token provided', () => {
      const mockClient: any = {
        id: 'socket-2',
        data: {},
        handshake: {
          auth: {},
          headers: {},
        },
      };

      gateway.handleConnection(mockClient);
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

      const res = await gateway.handleHostCreate(mockClient, { quizId });
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

      const createRes = await gateway.handleHostCreate(hostClient, { quizId });
      const pin = createRes.pin!;

      const playerClient: any = {
        id: 'player-1',
        join: vi.fn(),
      };

      const joinRes = gateway.handlePlayerJoin(playerClient, {
        pin,
        nickname: 'Gamer',
      });
      expect(joinRes.success).toBe(true);
      expect(playerClient.join).toHaveBeenCalledWith(`game:${pin}`);

      // Host starts game
      gateway.handleHostStart(hostClient);
      const session = mockGameStateStore.getSession(pin)!;
      expect(session.state).toBe('question');

      // Player answers
      const ansRes = gateway.handlePlayerAnswer(playerClient, {
        pin,
        choiceId: 'c1',
      });
      expect(ansRes.success).toBe(true);
      expect(ansRes.isCorrect).toBe(true);

      // Host reveals
      const revealRes = gateway.handleHostReveal(hostClient);
      expect(revealRes.success).toBe(true);
      expect(session.state).toBe('reveal');

      // Host moves to next (which completes game since only 1 question)
      const nextRes = await gateway.handleHostNext(hostClient);
      expect(nextRes.success).toBe(true);
      expect(session.state).toBe('ended');
      expect(mockGameSessionModel.create).toHaveBeenCalled();
    });
  });
});
