import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { User, UserDocument, SessionInfo } from './schemas/user.schema';
import { UpdateProfileDto, AdminQueryUsersDto } from './dto/user.dto';
import { UserRepository } from './repositories';
import { GamificationService } from '../gamification/gamification.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly gamificationService: GamificationService,
  ) {}

  async create(userData: Partial<User>): Promise<UserDocument> {
    return this.userRepository.create(userData);
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userRepository.findById(id);
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userRepository.findByEmail(email);
  }

  async findByUsername(username: string): Promise<UserDocument | null> {
    return this.userRepository.findByUsername(username);
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

    const updatedUser = await this.userRepository.updateProfile(userId, dto);

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
    return this.userRepository.findByVerificationToken(token);
  }

  async findByPasswordResetToken(token: string): Promise<UserDocument | null> {
    return this.userRepository.findByPasswordResetToken(token);
  }

  async setEmailVerificationToken(
    userId: string,
    token: string,
    expires: Date,
  ): Promise<UserDocument | null> {
    return this.userRepository.setEmailVerificationToken(
      userId,
      token,
      expires,
    );
  }

  async markEmailAsVerified(userId: string): Promise<UserDocument | null> {
    return this.userRepository.markEmailAsVerified(userId);
  }

  async setPasswordResetToken(
    userId: string,
    token: string,
    expires: Date,
  ): Promise<UserDocument | null> {
    return this.userRepository.setPasswordResetToken(userId, token, expires);
  }

  async resetPassword(
    userId: string,
    passwordHash: string,
  ): Promise<UserDocument | null> {
    return this.userRepository.resetPassword(userId, passwordHash);
  }

  async updatePassword(
    userId: string,
    passwordHash: string,
  ): Promise<UserDocument> {
    const user = await this.userRepository.updatePassword(userId, passwordHash);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async deleteAccount(
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepository.deleteAccount(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return { success: true, message: 'Account deleted successfully' };
  }

  // --- Gamification Delegations ---
  async recordActivity(userId: string) {
    return this.gamificationService.recordActivity(userId);
  }

  async refillHearts(userId: string, cost = 50) {
    return this.gamificationService.refillHearts(userId, cost);
  }

  async consumeHeart(userId: string) {
    return this.gamificationService.consumeHeart(userId);
  }

  async buyStreakFreeze(userId: string, cost = 100, maxFreezes = 2) {
    return this.gamificationService.buyStreakFreeze(userId, cost, maxFreezes);
  }

  async addXp(userId: string, points: number) {
    return this.gamificationService.addXp(userId, points);
  }

  async getLeaderboard(limit = 20) {
    return this.gamificationService.getLeaderboard(limit);
  }

  // --- Admin Queries ---
  async findAllAdmin(query: AdminQueryUsersDto) {
    const filter: Record<string, unknown> = {};

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
      this.userRepository.countUsers(filter),
      this.userRepository.findPaginatedUsers(filter, skip, limit),
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
    const user = await this.userRepository.findAdminUserById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateUserRole(id: string, role: string): Promise<UserDocument> {
    const user = await this.userRepository.updateUserRole(id, role);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateUserStatus(id: string, isActive: boolean): Promise<UserDocument> {
    const user = await this.userRepository.updateUserStatus(id, isActive);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  // --- Session Management ---
  async addSession(userId: string, session: SessionInfo) {
    return this.userRepository.addSession(userId, session);
  }

  async removeSession(userId: string, sessionId: string) {
    return this.userRepository.removeSession(userId, sessionId);
  }

  async rotateSession(
    userId: string,
    oldSessionId: string,
    newSession: SessionInfo,
  ) {
    return this.userRepository.rotateSession(userId, oldSessionId, newSession);
  }

  async removeAllSessions(userId: string) {
    return this.userRepository.clearAllSessions(userId);
  }

  async removeAllOtherSessions(userId: string, currentSessionId: string) {
    return this.userRepository.clearAllOtherSessions(userId, currentSessionId);
  }

  async getSessions(userId: string) {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const now = new Date();
    return (user.sessions || []).filter((s) => s.expiresAt > now);
  }
}
