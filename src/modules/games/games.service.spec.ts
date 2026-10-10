import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { GamesService } from './games.service';
import { GameStateStore } from './game-state.store';
import { QuizzesService } from '../quizzes/quizzes.service';

describe('GamesService', () => {
  let service: GamesService;
  let mockGameStateStore: GameStateStore;
  let mockQuizzesService: any;
  let mockJwtService: any;
  let mockGameSessionRepository: any;

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

    service = new GamesService(
      mockGameStateStore,
      mockQuizzesService,
      mockJwtService,
      mockGameSessionRepository,
    );
  });

  describe('authenticateToken', () => {
    it('should return payload on valid token', () => {
      const payload = service.authenticateToken('valid-token');
      expect(payload).toEqual({ id: 'user-1', username: 'TeacherBob' });
      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-token');
    });

    it('should strip Bearer prefix if present', () => {
      const payload = service.authenticateToken('Bearer valid-token');
      expect(payload).toEqual({ id: 'user-1', username: 'TeacherBob' });
      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-token');
    });

    it('should return null when token is missing or invalid', () => {
      expect(service.authenticateToken()).toBeNull();

      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid');
      });
      expect(service.authenticateToken('bad-token')).toBeNull();
    });
  });

  describe('handleDisconnect', () => {
    it('should remove socket from game state store', () => {
      const res = service.handleDisconnect('socket-1');
      expect(res).toBeDefined();
    });
  });

  describe('createGameSession', () => {
    it('should create session when quiz has questions', async () => {
      const mockQuiz = {
        _id: new Types.ObjectId(),
        title: 'Science Quiz',
        questions: [
          {
            questionText: 'Q1',
            choices: [
              { id: 'c1', text: 'Ans 1', isCorrect: true, color: 'red' },
            ],
          },
        ],
      };
      (mockQuizzesService.findOne as any).mockResolvedValue(mockQuiz);

      const res = await service.createGameSession(
        'host-socket',
        mockQuiz._id.toString(),
        'user-1',
      );

      expect(res.pin).toBeDefined();
      expect(res.quizTitle).toBe('Science Quiz');
      expect(res.totalQuestions).toBe(1);
    });

    it('should throw error when quiz has no questions', async () => {
      const mockQuiz = {
        _id: new Types.ObjectId(),
        title: 'Empty Quiz',
        questions: [],
      };
      (mockQuizzesService.findOne as any).mockResolvedValue(mockQuiz);

      await expect(
        service.createGameSession('host-socket', mockQuiz._id.toString()),
      ).rejects.toThrow('Quiz has no questions');
    });
  });

  describe('joinGame, startGame, answer, reveal, next', () => {
    it('should run full session lifecycle through GamesService', async () => {
      const quizId = new Types.ObjectId().toString();
      const mockQuiz = {
        _id: quizId,
        title: 'Math Quiz',
        questions: [
          {
            questionText: '1 + 1?',
            timeLimit: 20,
            points: 1000,
            mediaUrl: '',
            choices: [
              { id: 'c1', text: '2', isCorrect: true, color: 'blue' },
              { id: 'c2', text: '3', isCorrect: false, color: 'red' },
            ],
          },
        ],
      };
      (mockQuizzesService.findOne as any).mockResolvedValue(mockQuiz);

      // Create session
      const created = await service.createGameSession(
        'host-1',
        quizId,
        'teacher-1',
      );
      const pin = created.pin;

      // Join player
      const joinRes = service.joinGame(pin, 'player-1', 'Alice');
      expect(joinRes.success).toBe(true);
      expect(joinRes.playerCount).toBe(1);

      // Start game
      const startRes = service.startGame('host-1');
      expect(startRes.success).toBe(true);
      expect(startRes.questionIndex).toBe(0);
      expect(startRes.payload?.questionText).toBe('1 + 1?');

      // Player answers
      const ansRes = service.recordAnswer(pin, 'player-1', 'c1');
      expect(ansRes.success).toBe(true);
      expect(ansRes.isCorrect).toBe(true);
      expect(ansRes.answeredCount).toBe(1);

      // Reveal
      const revealRes = service.revealQuestion('host-1');
      expect(revealRes.success).toBe(true);
      expect(revealRes.payload?.correctChoiceId).toBe('c1');

      // Next question finishes game
      const nextRes = await service.nextQuestionOrFinish('host-1');
      expect(nextRes.success).toBe(true);
      expect(nextRes.isFinished).toBe(true);
      expect(nextRes.podium).toBeDefined();
      expect(mockGameSessionRepository.create).toHaveBeenCalled();
      expect(mockQuizzesService.incrementPlayCount).toHaveBeenCalledWith(
        quizId,
      );
    });

    it('should delegate game session persistence to JobsProducerService when provided', async () => {
      const mockJobsProducer = {
        saveGameSessionReport: vi.fn().mockResolvedValue(undefined),
      };

      const customService = new GamesService(
        mockGameStateStore,
        mockQuizzesService as unknown as QuizzesService,
        mockJwtService as unknown as JwtService,
        mockGameSessionRepository as unknown as GameSessionRepository,
        mockJobsProducer as any,
      );

      const quizId = new Types.ObjectId().toString();
      (mockQuizzesService.findOne as any).mockResolvedValue({
        _id: quizId,
        title: 'Async Quiz',
        questions: [{ questionText: 'Q1', choices: [] }],
      });

      const session = mockGameStateStore.createSession(
        'host-async',
        quizId,
        'Async Quiz',
        [{ questionText: 'Q1', choices: [] }],
        'host-u1',
      );
      await customService.finishGame(session);

      expect(mockJobsProducer.saveGameSessionReport).toHaveBeenCalledWith(
        expect.objectContaining({
          pin: session.pin,
          quizId,
          quizTitle: 'Async Quiz',
          hostUserId: 'host-u1',
        }),
      );
    });

    it('should return failure if host session not found for start or reveal', () => {
      const startRes = service.startGame('unknown-host');
      expect(startRes.success).toBe(false);

      const revealRes = service.revealQuestion('unknown-host');
      expect(revealRes.success).toBe(false);
    });
  });
});
