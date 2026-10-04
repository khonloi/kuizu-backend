import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

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
      xp: user.xp,
      streak: user.streak,
      hearts: user.hearts,
      gems: user.gems,
      league: user.league,
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
}
