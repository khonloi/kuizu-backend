import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseRepository } from '../../../common/database';
import { User, UserDocument } from '../schemas/user.schema';
import { UpdateProfileDto } from '../dto/user.dto';

@Injectable()
export class UserRepository extends BaseRepository<UserDocument> {
  constructor(
    @InjectModel(User.name)
    userModel: Model<UserDocument>,
  ) {
    super(userModel);
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.findOne({ email: email.toLowerCase() });
  }

  async findByUsername(username: string): Promise<UserDocument | null> {
    return this.findOne({ username });
  }

  async findByVerificationToken(token: string): Promise<UserDocument | null> {
    return this.findOne({ emailVerificationToken: token });
  }

  async findByPasswordResetToken(token: string): Promise<UserDocument | null> {
    return this.findOne({ passwordResetToken: token });
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserDocument | null> {
    return this.findByIdAndUpdate(userId, { $set: dto }, { new: true });
  }

  async setEmailVerificationToken(
    userId: string,
    token: string,
    expires: Date,
  ): Promise<UserDocument | null> {
    return this.findByIdAndUpdate(
      userId,
      {
        $set: {
          emailVerificationToken: token,
          emailVerificationExpires: expires,
        },
      },
      { new: true },
    );
  }

  async markEmailAsVerified(userId: string): Promise<UserDocument | null> {
    return this.findByIdAndUpdate(
      userId,
      {
        $set: {
          isEmailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
        },
      },
      { new: true },
    );
  }

  async setPasswordResetToken(
    userId: string,
    token: string,
    expires: Date,
  ): Promise<UserDocument | null> {
    return this.findByIdAndUpdate(
      userId,
      {
        $set: {
          passwordResetToken: token,
          passwordResetExpires: expires,
        },
      },
      { new: true },
    );
  }

  async resetPassword(
    userId: string,
    passwordHash: string,
  ): Promise<UserDocument | null> {
    return this.findByIdAndUpdate(
      userId,
      {
        $set: {
          passwordHash,
          passwordResetToken: null,
          passwordResetExpires: null,
        },
      },
      { new: true },
    );
  }

  async updatePassword(
    userId: string,
    passwordHash: string,
  ): Promise<UserDocument | null> {
    return this.findByIdAndUpdate(
      userId,
      { $set: { passwordHash } },
      { new: true },
    );
  }

  async deleteAccount(userId: string): Promise<UserDocument | null> {
    return this.findByIdAndDelete(userId);
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
    return this.findByIdAndUpdate(
      userId,
      {
        $set: { hearts: 5 },
        $inc: { gems: -cost },
      },
      { new: true },
    );
  }

  async consumeHeart(userId: string): Promise<UserDocument | null> {
    return this.findByIdAndUpdate(
      userId,
      {
        $inc: { hearts: -1 },
      },
      { new: true },
    );
  }

  async buyStreakFreeze(
    userId: string,
    cost: number,
  ): Promise<UserDocument | null> {
    return this.findByIdAndUpdate(
      userId,
      {
        $inc: {
          streakFreezes: 1,
          gems: -cost,
        },
      },
      { new: true },
    );
  }

  async addXp(userId: string, points: number): Promise<UserDocument | null> {
    return this.findByIdAndUpdate(
      userId,
      { $inc: { xp: points } },
      { new: true },
    );
  }

  async getLeaderboard(limit = 20): Promise<UserDocument[]> {
    return this.executeQuery(
      this.model.find({}, { passwordHash: 0 }).sort({ xp: -1 }).limit(limit),
    );
  }

  async findPaginatedUsers(
    filter: Record<string, unknown>,
    skip: number,
    limit: number,
  ): Promise<UserDocument[]> {
    return this.executeQuery(
      this.model
        .find(filter, {
          passwordHash: 0,
          emailVerificationToken: 0,
          passwordResetToken: 0,
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    );
  }

  async countUsers(filter: Record<string, unknown>): Promise<number> {
    return this.countDocuments(filter);
  }

  async findAdminUserById(id: string): Promise<UserDocument | null> {
    return this.executeQuery(this.model.findById(id, { passwordHash: 0 }));
  }

  async updateUserRole(id: string, role: string): Promise<UserDocument | null> {
    const query = this.model
      .findByIdAndUpdate(id, { $set: { role } }, { new: true })
      .select('-passwordHash');
    return this.executeQuery(query);
  }

  async updateUserStatus(
    id: string,
    isActive: boolean,
  ): Promise<UserDocument | null> {
    const query = this.model
      .findByIdAndUpdate(id, { $set: { isActive } }, { new: true })
      .select('-passwordHash');
    return this.executeQuery(query);
  }
}
