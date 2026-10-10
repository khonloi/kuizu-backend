import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { GameReportsProcessor } from './game-reports.processor';
import { GameSessionRepository } from '../../games/repositories';
import { QuizRepository } from '../../quizzes/repositories';

describe('GameReportsProcessor', () => {
  let processor: GameReportsProcessor;
  let mockGameSessionRepository: any;
  let mockQuizRepository: any;

  beforeEach(() => {
    mockGameSessionRepository = {
      create: vi.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
    };

    mockQuizRepository = {
      incrementPlayCount: vi.fn().mockResolvedValue(undefined),
    };

    processor = new GameReportsProcessor(
      mockGameSessionRepository as unknown as GameSessionRepository,
      mockQuizRepository as unknown as QuizRepository,
    );
  });

  it('should process save-game-session job and persist history and increment playCount', async () => {
    const quizId = new Types.ObjectId().toString();
    const hostId = new Types.ObjectId().toString();

    const job = {
      id: 'job-report-1',
      name: 'save-game-session',
      data: {
        pin: '123456',
        hostUserId: hostId,
        quizId,
        quizTitle: 'Geography Trivia',
        players: [
          { nickname: 'PlayerA', score: 1000, rank: 1 },
          { nickname: 'PlayerB', score: 800, rank: 2 },
        ],
      },
    } as any;

    const result = await processor.process(job);

    expect(result).toEqual({ saved: true, pin: '123456' });
    expect(mockGameSessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        pin: '123456',
        quizTitle: 'Geography Trivia',
        status: 'completed',
        players: [
          { nickname: 'PlayerA', score: 1000, rank: 1 },
          { nickname: 'PlayerB', score: 800, rank: 2 },
        ],
      }),
    );
    expect(mockQuizRepository.incrementPlayCount).toHaveBeenCalledWith(quizId);
  });

  it('should return saved: false for invalid quizId', async () => {
    const job = {
      id: 'job-report-2',
      name: 'save-game-session',
      data: {
        pin: '999999',
        quizId: 'invalid-quiz-id',
        quizTitle: 'Test',
        players: [],
      },
    } as any;

    const result = await processor.process(job);
    expect(result).toEqual({ saved: false, pin: '999999' });
    expect(mockGameSessionRepository.create).not.toHaveBeenCalled();
  });

  it('should handle unknown job gracefully', async () => {
    const job = {
      id: 'job-report-3',
      name: 'unknown-job',
      data: {},
    } as any;

    const result = await processor.process(job);
    expect(result).toEqual({ saved: false, pin: '' });
  });
});
