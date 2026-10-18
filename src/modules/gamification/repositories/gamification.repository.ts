import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseRepository } from '../../../common/database';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { GAMIFICATION_CONSTANTS } from '../../../common/constants';

export interface IGamificationRepository {
  findById(userId: string): Promise<UserDocument | null>;
  updateActivityStreak(
    userId: string,
    streakCount: number,
    lastActiveDate: Date,
    streakFreezes: number,
  ): Promise<UserDocument | null>;
  refillHearts(userId: string, cost: number): Promise<UserDocument | null>;
  consumeHeart(userId: string): Promise<UserDocument | null>;
  buyStreakFreeze(
    userId: string,
    cost: number,
    maxFreezes?: number,
  ): Promise<UserDocument | null>;
  addXp(userId: string, points: number): Promise<UserDocument | null>;
  getLeaderboard(limit?: number): Promise<UserDocument[]>;
}

@Injectable()
export class GamificationRepository
  extends BaseRepository<UserDocument>
  implements IGamificationRepository
{
  constructor(
    @InjectModel(User.name)
    userModel: Model<UserDocument>,
  ) {
    super(userModel);
  }

  async updateActivityStreak(
    userId: string,
    streakCount: number,
    lastActiveDate: Date,
    streakFreezes: number,
  ): Promise<UserDocument | null> {
    return this.findByIdAndUpdate(
      userId,
      {
        $set: {
          'streak.count': streakCount,
          'streak.lastActiveDate': lastActiveDate,
          streakFreezes,
        },
      },
      { new: true },
    );
  }

  async refillHearts(
    userId: string,
    cost: number,
  ): Promise<UserDocument | null> {
    return this.findOneAndUpdate(
      {
        _id: userId,
        gems: { $gte: cost },
        hearts: { $lt: GAMIFICATION_CONSTANTS.MAX_HEARTS },
      },
      {
        $set: { hearts: GAMIFICATION_CONSTANTS.MAX_HEARTS },
        $inc: { gems: -cost },
      },
      { new: true, runValidators: true },
    );
  }

  async consumeHeart(userId: string): Promise<UserDocument | null> {
    return this.findOneAndUpdate(
      {
        _id: userId,
        hearts: { $gt: 0 },
      },
      {
        $inc: { hearts: -1 },
      },
      { new: true, runValidators: true },
    );
  }

  async buyStreakFreeze(
    userId: string,
    cost: number,
    maxFreezes: number = GAMIFICATION_CONSTANTS.MAX_STREAK_FREEZES,
  ): Promise<UserDocument | null> {
    return this.findOneAndUpdate(
      {
        _id: userId,
        gems: { $gte: cost },
        streakFreezes: { $lt: maxFreezes },
      },
      {
        $inc: {
          streakFreezes: 1,
          gems: -cost,
        },
      },
      { new: true, runValidators: true },
    );
  }

  async addXp(userId: string, points: number): Promise<UserDocument | null> {
    return this.findByIdAndUpdate(
      userId,
      { $inc: { xp: points } },
      { new: true },
    );
  }

  async getLeaderboard(
    limit: number = GAMIFICATION_CONSTANTS.DEFAULT_LEADERBOARD_LIMIT,
  ): Promise<UserDocument[]> {
    return this.executeQuery(
      this.model
        .find(
          { isActive: true },
          { username: 1, avatarUrl: 1, xp: 1, streak: 1, league: 1 },
        )
        .sort({ xp: -1 })
        .limit(limit),
    );
  }
}
