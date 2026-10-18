import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { GamificationRepository } from './repositories';
import { RedisService } from '../../common/redis/redis.service';
import { GAMIFICATION_CONSTANTS } from '../../common/constants';

@Injectable()
export class GamificationService {
  constructor(
    private readonly gamificationRepository: GamificationRepository,
    @Optional() private readonly redisService?: RedisService,
  ) {}

  async recordActivity(userId: string) {
    const user = await this.gamificationRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const now = new Date();
    const todayDateString = now.toISOString().slice(0, 10);
    const lastActiveDate = user.streak?.lastActiveDate
      ? new Date(user.streak.lastActiveDate)
      : null;

    let newCount = user.streak?.count || 0;
    let streakFreezes = user.streakFreezes ?? 0;
    let message = 'Activity recorded.';

    if (!lastActiveDate) {
      newCount = 1;
      message = 'First activity recorded! Streak started at 1 day.';
    } else {
      const lastDateString = lastActiveDate.toISOString().slice(0, 10);
      if (todayDateString === lastDateString) {
        message = 'Activity already recorded today. Streak maintained.';
      } else {
        const todayTime = new Date(todayDateString).getTime();
        const lastTime = new Date(lastDateString).getTime();
        const diffDays = Math.round(
          (todayTime - lastTime) / GAMIFICATION_CONSTANTS.MS_PER_DAY,
        );

        if (diffDays === 1) {
          newCount += 1;
          message = `Streak extended to ${newCount} days!`;
        } else if (diffDays > 1) {
          if (streakFreezes > 0) {
            streakFreezes -= 1;
            newCount += 1;
            message = `Streak freeze consumed! Streak preserved and increased to ${newCount} days.`;
          } else {
            newCount = 1;
            message = 'Streak was broken. Started a new 1-day streak.';
          }
        }
      }
    }

    const updatedUser = await this.gamificationRepository.updateActivityStreak(
      userId,
      newCount,
      now,
      streakFreezes,
    );

    return {
      streak: updatedUser?.streak,
      streakFreezes: updatedUser?.streakFreezes ?? 0,
      message,
    };
  }

  async refillHearts(
    userId: string,
    cost: number = GAMIFICATION_CONSTANTS.HEART_REFILL_COST,
  ) {
    const user = await this.gamificationRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.hearts >= GAMIFICATION_CONSTANTS.MAX_HEARTS) {
      throw new BadRequestException('Hearts are already full');
    }

    if (user.gems < cost) {
      throw new BadRequestException('Not enough gems to refill hearts');
    }

    const updatedUser = await this.gamificationRepository.refillHearts(
      userId,
      cost,
    );
    if (!updatedUser) {
      throw new BadRequestException(
        'Hearts could not be refilled (concurrent change or insufficient gems)',
      );
    }

    return {
      hearts: updatedUser.hearts ?? GAMIFICATION_CONSTANTS.MAX_HEARTS,
      gems: updatedUser.gems ?? 0,
      message: 'Hearts successfully refilled to maximum',
    };
  }

  async consumeHeart(userId: string) {
    const user = await this.gamificationRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.hearts <= 0) {
      throw new BadRequestException('No hearts remaining');
    }

    const updatedUser = await this.gamificationRepository.consumeHeart(userId);
    if (!updatedUser) {
      throw new BadRequestException('No hearts remaining');
    }

    return {
      hearts: updatedUser.hearts ?? 0,
      message: 'Heart consumed',
    };
  }

  async buyStreakFreeze(
    userId: string,
    cost: number = GAMIFICATION_CONSTANTS.STREAK_FREEZE_COST,
    maxFreezes: number = GAMIFICATION_CONSTANTS.MAX_STREAK_FREEZES,
  ) {
    const user = await this.gamificationRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const currentFreezes = user.streakFreezes ?? 0;
    if (currentFreezes >= maxFreezes) {
      throw new BadRequestException('Maximum streak freezes already reached');
    }

    if (user.gems < cost) {
      throw new BadRequestException('Not enough gems to buy a streak freeze');
    }

    const updatedUser = await this.gamificationRepository.buyStreakFreeze(
      userId,
      cost,
      maxFreezes,
    );
    if (!updatedUser) {
      throw new BadRequestException(
        'Streak freeze could not be purchased (concurrent change or limit reached)',
      );
    }

    return {
      streakFreezes: updatedUser.streakFreezes ?? 1,
      gems: updatedUser.gems ?? 0,
      message: 'Streak freeze purchased successfully',
    };
  }

  async addXp(userId: string, points: number) {
    const res = await this.gamificationRepository.addXp(userId, points);
    if (this.redisService) {
      void this.redisService.delPattern('leaderboard:*');
    }
    return res;
  }

  async getLeaderboard(
    limit: number = GAMIFICATION_CONSTANTS.DEFAULT_LEADERBOARD_LIMIT,
  ) {
    const cacheKey = `leaderboard:top:${limit}`;
    if (this.redisService) {
      const cached = await this.redisService.get<any[]>(cacheKey);
      if (cached) return cached;
    }

    const leaderboard = await this.gamificationRepository.getLeaderboard(limit);

    if (this.redisService) {
      await this.redisService.set(cacheKey, leaderboard, 60);
    }

    return leaderboard;
  }
}
