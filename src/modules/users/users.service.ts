import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { UpdateProfileDto, AdminQueryUsersDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async create(userData: Partial<User>): Promise<UserDocument> {
    const createdUser = new this.userModel(userData);
    return createdUser.save();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  async findByUsername(username: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ username }).exec();
  }

  async getProfile(userId: string) {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return {
      id: user._id,
      email: user.email,
      username: user.username,
      role: user.role,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive ?? true,
      isEmailVerified: user.isEmailVerified ?? false,
      xp: user.xp,
      streak: user.streak,
      streakFreezes: user.streakFreezes ?? 0,
      hearts: user.hearts,
      gems: user.gems,
      league: user.league,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.username && dto.username !== user.username) {
      const existing = await this.findByUsername(dto.username);
      if (existing && existing._id.toString() !== userId) {
        throw new ConflictException('Username already taken');
      }
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(userId, { $set: dto }, { new: true })
      .exec();

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return {
      id: updatedUser._id,
      email: updatedUser.email,
      username: updatedUser.username,
      role: updatedUser.role,
      avatarUrl: updatedUser.avatarUrl,
      isActive: updatedUser.isActive ?? true,
      isEmailVerified: updatedUser.isEmailVerified ?? false,
      xp: updatedUser.xp,
      streak: updatedUser.streak,
      streakFreezes: updatedUser.streakFreezes ?? 0,
      hearts: updatedUser.hearts,
      gems: updatedUser.gems,
      league: updatedUser.league,
    };
  }

  async findByVerificationToken(token: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ emailVerificationToken: token }).exec();
  }

  async findByPasswordResetToken(token: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ passwordResetToken: token }).exec();
  }

  async setEmailVerificationToken(
    userId: string,
    token: string,
    expires: Date,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        {
          $set: {
            emailVerificationToken: token,
            emailVerificationExpires: expires,
          },
        },
        { new: true },
      )
      .exec();
  }

  async markEmailAsVerified(userId: string): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        {
          $set: {
            isEmailVerified: true,
            emailVerificationToken: null,
            emailVerificationExpires: null,
          },
        },
        { new: true },
      )
      .exec();
  }

  async setPasswordResetToken(
    userId: string,
    token: string,
    expires: Date,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        {
          $set: {
            passwordResetToken: token,
            passwordResetExpires: expires,
          },
        },
        { new: true },
      )
      .exec();
  }

  async resetPassword(
    userId: string,
    passwordHash: string,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        {
          $set: {
            passwordHash,
            passwordResetToken: null,
            passwordResetExpires: null,
          },
        },
        { new: true },
      )
      .exec();
  }

  async updatePassword(
    userId: string,
    passwordHash: string,
  ): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(userId, { $set: { passwordHash } }, { new: true })
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async deleteAccount(
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.userModel.findByIdAndDelete(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return { success: true, message: 'Account deleted successfully' };
  }

  async recordActivity(userId: string) {
    const user = await this.findById(userId);
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

    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        userId,
        {
          $set: {
            'streak.count': newCount,
            'streak.lastActiveDate': now,
            streakFreezes,
          },
        },
        { new: true },
      )
      .exec();

    return {
      streak: updatedUser?.streak,
      streakFreezes: updatedUser?.streakFreezes ?? 0,
      message,
    };
  }

  async refillHearts(userId: string, cost = 50) {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.hearts >= 5) {
      throw new BadRequestException('Hearts are already full');
    }

    if (user.gems < cost) {
      throw new BadRequestException('Not enough gems to refill hearts');
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        userId,
        {
          $set: { hearts: 5 },
          $inc: { gems: -cost },
        },
        { new: true },
      )
      .exec();

    return {
      hearts: updatedUser?.hearts ?? 5,
      gems: updatedUser?.gems ?? 0,
      message: 'Hearts successfully refilled to maximum',
    };
  }

  async consumeHeart(userId: string) {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.hearts <= 0) {
      throw new BadRequestException('No hearts remaining');
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        userId,
        {
          $inc: { hearts: -1 },
        },
        { new: true },
      )
      .exec();

    return {
      hearts: updatedUser?.hearts ?? 0,
      message: 'Heart consumed',
    };
  }

  async buyStreakFreeze(userId: string, cost = 100, maxFreezes = 2) {
    const user = await this.findById(userId);
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

    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        userId,
        {
          $inc: {
            streakFreezes: 1,
            gems: -cost,
          },
        },
        { new: true },
      )
      .exec();

    return {
      streakFreezes: updatedUser?.streakFreezes ?? 1,
      gems: updatedUser?.gems ?? 0,
      message: 'Streak freeze purchased successfully',
    };
  }

  async addXp(userId: string, points: number) {
    return this.userModel.findByIdAndUpdate(
      userId,
      { $inc: { xp: points } },
      { new: true },
    );
  }

  async getLeaderboard(limit = 20) {
    return this.userModel
      .find({}, { passwordHash: 0 })
      .sort({ xp: -1 })
      .limit(limit)
      .exec();
  }

  async findAllAdmin(query: AdminQueryUsersDto) {
    const filter: any = {};

    if (query.role) {
      filter.role = query.role;
    }

    if (query.isActive !== undefined) {
      filter.isActive = query.isActive;
    }

    if (query.search) {
      filter.$or = [
        { email: { $regex: query.search, $options: 'i' } },
        { username: { $regex: query.search, $options: 'i' } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [total, users] = await Promise.all([
      this.userModel.countDocuments(filter).exec(),
      this.userModel
        .find(filter, {
          passwordHash: 0,
          emailVerificationToken: 0,
          passwordResetToken: 0,
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
    ]);

    return {
      data: users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findAdminUserById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id, { passwordHash: 0 }).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateUserRole(id: string, role: string): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(id, { $set: { role } }, { new: true })
      .select('-passwordHash')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateUserStatus(id: string, isActive: boolean): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(id, { $set: { isActive } }, { new: true })
      .select('-passwordHash')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}
