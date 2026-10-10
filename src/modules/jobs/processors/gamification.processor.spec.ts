import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { GamificationProcessor } from './gamification.processor';
import { UserRepository } from '../../users/repositories';

describe('GamificationProcessor', () => {
  let processor: GamificationProcessor;
  let mockUserRepository: any;

  beforeEach(() => {
    mockUserRepository = {
      find: vi.fn(),
      findByIdAndUpdate: vi.fn(),
    };

    processor = new GamificationProcessor(
      mockUserRepository as unknown as UserRepository,
    );
  });

  it('should promote top performers and demote bottom performers in calculate-league-standings job', async () => {
    // 5 bronze users
    const bronzeUsers = Array.from({ length: 5 }, (_, i) => ({
      _id: new Types.ObjectId(),
      username: `Bronze${i + 1}`,
      xp: (5 - i) * 100,
      league: 'bronze',
    }));

    // 5 silver users
    const silverUsers = Array.from({ length: 5 }, (_, i) => ({
      _id: new Types.ObjectId(),
      username: `Silver${i + 1}`,
      xp: (5 - i) * 100,
      league: 'silver',
    }));

    mockUserRepository.find.mockImplementation((filter: any) => {
      if (filter.league === 'bronze') return Promise.resolve(bronzeUsers);
      if (filter.league === 'silver') return Promise.resolve(silverUsers);
      return Promise.resolve([]);
    });

    const job = {
      id: 'job-gami-1',
      name: 'calculate-league-standings',
      data: {},
    } as any;

    const result = await processor.process(job);

    expect(result.evaluated).toBe(10);
    expect(result.promoted).toBeGreaterThanOrEqual(2); // Top 20% of bronze and silver
    expect(result.demoted).toBeGreaterThanOrEqual(1); // Bottom 20% of silver (bronze cannot demote)
    expect(mockUserRepository.findByIdAndUpdate).toHaveBeenCalled();
  });

  it('should skip promotion/demotion if tier has fewer than 5 users', async () => {
    mockUserRepository.find.mockResolvedValue([
      { _id: new Types.ObjectId(), xp: 50, league: 'gold' },
    ]);

    const job = {
      id: 'job-gami-2',
      name: 'calculate-league-standings',
      data: {},
    } as any;

    const result = await processor.process(job);

    expect(result.promoted).toBe(0);
    expect(result.demoted).toBe(0);
    expect(mockUserRepository.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('should handle unknown job gracefully', async () => {
    const job = {
      id: 'job-gami-3',
      name: 'unknown-gamification-job',
      data: {},
    } as any;

    const result = await processor.process(job);
    expect(result).toEqual({ promoted: 0, demoted: 0, evaluated: 0 });
  });
});
