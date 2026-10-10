import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { UserRepository } from '../users/repositories';

@Injectable()
export class GamificationService {
  constructor(private readonly userRepository: UserRepository) {}

  async recordActivity(userId: string) {
    const user = await this.userRepository.findById(userId);
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
        const diffDays = Math.round((todayTime - lastTime) / 86400000);

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

    const updatedUser = await this.userRepository.updateActivityStreak(
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

  async refillHearts(userId: string, cost = 50) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.hearts >= 5) {
      throw new BadRequestException('Hearts are already full');
    }

    if (user.gems < cost) {
      throw new BadRequestException('Not enough gems to refill hearts');
    }

    const updatedUser = await this.userRepository.refillHearts(userId, cost);

    return {
      hearts: updatedUser?.hearts ?? 5,
      gems: updatedUser?.gems ?? 0,
      message: 'Hearts successfully refilled to maximum',
    };
  }

  async consumeHeart(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.hearts <= 0) {
      throw new BadRequestException('No hearts remaining');
    }

    const updatedUser = await this.userRepository.consumeHeart(userId);

    return {
      hearts: updatedUser?.hearts ?? 0,
      message: 'Heart consumed',
    };
  }

  async buyStreakFreeze(userId: string, cost = 100, maxFreezes = 2) {
    const user = await this.userRepository.findById(userId);
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

    const updatedUser = await this.userRepository.buyStreakFreeze(userId, cost);

    return {
      streakFreezes: updatedUser?.streakFreezes ?? 1,
      gems: updatedUser?.gems ?? 0,
      message: 'Streak freeze purchased successfully',
    };
  }

  async addXp(userId: string, points: number) {
    return this.userRepository.addXp(userId, points);
  }

  async getLeaderboard(limit = 20) {
    return this.userRepository.getLeaderboard(limit);
  }
}
