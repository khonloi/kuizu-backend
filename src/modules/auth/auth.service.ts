import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import {
  RegisterDto,
  LoginDto,
  ChangePasswordDto,
  VerifyEmailDto,
  ResendVerificationDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(
    dto: RegisterDto,
    clientMeta?: { userAgent?: string; ipAddress?: string },
  ) {
    const existingEmail = await this.usersService.findByEmail(dto.email);
    if (existingEmail) {
      throw new ConflictException('Email already in use');
    }

    const existingUsername = await this.usersService.findByUsername(
      dto.username,
    );
    if (existingUsername) {
      throw new ConflictException('Username already taken');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedVerificationToken = this.hashToken(verificationToken);
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await this.usersService.create({
      email: dto.email.toLowerCase(),
      username: dto.username,
      passwordHash,
      role: 'user',
      isActive: true,
      isEmailVerified: false,
      emailVerificationToken: hashedVerificationToken,
      emailVerificationExpires,
    });

    const tokens = this.generateTokens(
      user._id.toString(),
      user.email,
      user.username,
      user.role,
    );

    const tokenHash = this.hashToken(tokens.refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.usersService.addSession(user._id.toString(), {
      sessionId: tokens.sessionId,
      tokenHash,
      userAgent: clientMeta?.userAgent,
      ipAddress: clientMeta?.ipAddress,
      expiresAt,
      createdAt: new Date(),
    });

    return {
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
        isActive: user.isActive ?? true,
        isEmailVerified: user.isEmailVerified ?? false,
        xp: user.xp,
        streak: user.streak,
        hearts: user.hearts,
        gems: user.gems,
        league: user.league,
      },
      verificationToken,
      ...tokens,
    };
  }

  async login(
    dto: LoginDto,
    clientMeta?: { userAgent?: string; ipAddress?: string },
  ) {
    const isEmail = dto.emailOrUsername.includes('@');
    const user = isEmail
      ? await this.usersService.findByEmail(dto.emailOrUsername)
      : await this.usersService.findByUsername(dto.emailOrUsername);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.isActive === false) {
      throw new UnauthorizedException(
        'Account has been suspended or deactivated',
      );
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = this.generateTokens(
      user._id.toString(),
      user.email,
      user.username,
      user.role,
    );

    const tokenHash = this.hashToken(tokens.refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.usersService.addSession(user._id.toString(), {
      sessionId: tokens.sessionId,
      tokenHash,
      userAgent: clientMeta?.userAgent,
      ipAddress: clientMeta?.ipAddress,
      expiresAt,
      createdAt: new Date(),
    });

    return {
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
        isActive: user.isActive ?? true,
        isEmailVerified: user.isEmailVerified ?? false,
        xp: user.xp,
        streak: user.streak,
        hearts: user.hearts,
        gems: user.gems,
        league: user.league,
      },
      ...tokens,
    };
  }

  async refreshToken(
    refreshToken: string,
    clientMeta?: { userAgent?: string; ipAddress?: string },
  ) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    try {
      const refreshSecret =
        this.configService.get<string>('JWT_REFRESH_SECRET') ||
        'kuizu_super_secret_refresh_key_2026';
      const payload = this.jwtService.verify(refreshToken, {
        secret: refreshSecret,
      });

      const userId = payload.sub;
      const sessionId = payload.jti || payload.sid;

      const user = await this.usersService.findById(userId);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (user.isActive === false) {
        throw new UnauthorizedException(
          'Account has been suspended or deactivated',
        );
      }

      const incomingTokenHash = this.hashToken(refreshToken);
      const sessions = user.sessions || [];
      const existingSession = sessions.find((s) => s.sessionId === sessionId);

      // Replay Detection
      if (!existingSession) {
        throw new UnauthorizedException('Invalid or revoked refresh token');
      }

      if (existingSession.tokenHash !== incomingTokenHash) {
        // Reuse detected! Immediate revocation of all sessions for security
        await this.usersService.removeAllSessions(userId);
        throw new UnauthorizedException(
          'Refresh token reuse detected. All active sessions have been revoked for your security.',
        );
      }

      if (existingSession.expiresAt && existingSession.expiresAt < new Date()) {
        await this.usersService.removeSession(userId, sessionId);
        throw new UnauthorizedException('Refresh token has expired');
      }

      // Rotate session and tokens
      const newSessionId = crypto.randomUUID();
      const tokens = this.generateTokens(
        user._id.toString(),
        user.email,
        user.username,
        user.role,
        newSessionId,
      );

      const newTokenHash = this.hashToken(tokens.refreshToken);
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await this.usersService.rotateSession(userId, sessionId, {
        sessionId: newSessionId,
        tokenHash: newTokenHash,
        userAgent: clientMeta?.userAgent || existingSession.userAgent,
        ipAddress: clientMeta?.ipAddress || existingSession.ipAddress,
        expiresAt: newExpiresAt,
        createdAt: new Date(),
      });

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (err: any) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isMatch = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!isMatch) {
      throw new UnauthorizedException('Incorrect current password');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.usersService.updatePassword(userId, newPasswordHash);
    await this.usersService.removeAllSessions(userId);

    return {
      success: true,
      message: 'Password updated successfully',
    };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const hashedToken = this.hashToken(dto.token);
    const user = await this.usersService.findByVerificationToken(hashedToken);
    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (
      !user.emailVerificationExpires ||
      user.emailVerificationExpires < new Date()
    ) {
      throw new BadRequestException('Verification token has expired');
    }

    await this.usersService.markEmailAsVerified(user._id.toString());

    return {
      success: true,
      message: 'Email successfully verified',
    };
  }

  async resendVerification(dto: ResendVerificationDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      return {
        success: true,
        message:
          'If that email is registered, a verification link has been sent.',
      };
    }

    if (user.isEmailVerified) {
      return {
        success: true,
        message: 'Email is already verified.',
      };
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = this.hashToken(verificationToken);
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.usersService.setEmailVerificationToken(
      user._id.toString(),
      hashedToken,
      expires,
    );

    return {
      success: true,
      message: 'Verification link has been sent.',
      verificationToken,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      return {
        success: true,
        message:
          'If an account exists with that email, a password reset link has been sent.',
      };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = this.hashToken(resetToken);
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await this.usersService.setPasswordResetToken(
      user._id.toString(),
      hashedToken,
      expires,
    );

    return {
      success: true,
      message:
        'If an account exists with that email, a password reset link has been sent.',
      resetToken,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const hashedToken = this.hashToken(dto.token);
    const user = await this.usersService.findByPasswordResetToken(hashedToken);
    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (!user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      throw new BadRequestException('Password reset token has expired');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.usersService.resetPassword(user._id.toString(), newPasswordHash);
    await this.usersService.removeAllSessions(user._id.toString());

    return {
      success: true,
      message: 'Password has been reset successfully',
    };
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      try {
        const payload = this.jwtService.decode(refreshToken) as any;
        const sessionId = payload?.jti || payload?.sid;
        if (sessionId) {
          await this.usersService.removeSession(userId, sessionId);
          return { success: true, message: 'Logged out of current session' };
        }
      } catch {
        // decode failure falls through
      }
    }
    return { success: true, message: 'Logged out successfully' };
  }

  async getSessions(userId: string, currentRefreshToken?: string) {
    let currentSessionId: string | null = null;
    if (currentRefreshToken) {
      try {
        const payload = this.jwtService.decode(currentRefreshToken) as any;
        currentSessionId = payload?.jti || payload?.sid || null;
      } catch {
        // ignore invalid token decode
      }
    }

    const sessions = await this.usersService.getSessions(userId);
    return sessions.map((s) => ({
      sessionId: s.sessionId,
      userAgent: s.userAgent || 'Unknown Device',
      ipAddress: s.ipAddress || 'Unknown IP',
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      isCurrent: currentSessionId ? s.sessionId === currentSessionId : false,
    }));
  }

  async revokeSession(userId: string, sessionId: string) {
    await this.usersService.removeSession(userId, sessionId);
    return { success: true, message: 'Session revoked successfully' };
  }

  async revokeOtherSessions(userId: string, currentRefreshToken: string) {
    let currentSessionId: string | null = null;
    try {
      const payload = this.jwtService.decode(currentRefreshToken) as any;
      currentSessionId = payload?.jti || payload?.sid || null;
    } catch {
      // ignore
    }

    if (!currentSessionId) {
      throw new BadRequestException('Could not identify current session');
    }

    await this.usersService.removeAllOtherSessions(userId, currentSessionId);
    return {
      success: true,
      message: 'All other sessions revoked successfully',
    };
  }

  async revokeAllSessions(userId: string) {
    await this.usersService.removeAllSessions(userId);
    return { success: true, message: 'All active sessions revoked' };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private generateTokens(
    userId: string,
    email: string,
    username: string,
    role: string,
    sessionId?: string,
  ) {
    const sid = sessionId || crypto.randomUUID();
    const payload = { sub: userId, email, username, role, sid };
    const refreshPayload = { sub: userId, email, username, role, jti: sid };

    const accessSecret =
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      'kuizu_super_secret_access_key_2026';
    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      'kuizu_super_secret_refresh_key_2026';

    const accessToken = this.jwtService.sign(payload, {
      secret: accessSecret,
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: refreshSecret,
      expiresIn: '7d',
    });

    return { accessToken, refreshToken, sessionId: sid };
  }
}
