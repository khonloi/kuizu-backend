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

  async register(dto: RegisterDto) {
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

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await this.usersService.create({
      email: dto.email.toLowerCase(),
      username: dto.username,
      passwordHash,
      role: 'user',
      isActive: true,
      isEmailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires,
    });

    const tokens = this.generateTokens(
      user._id.toString(),
      user.email,
      user.username,
      user.role,
    );

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

  async login(dto: LoginDto) {
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

  async refreshToken(refreshToken: string) {
    try {
      const refreshSecret =
        this.configService.get<string>('JWT_REFRESH_SECRET') ||
        'kuizu_super_secret_refresh_key_2026';
      const payload = this.jwtService.verify(refreshToken, {
        secret: refreshSecret,
      });

      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const tokens = this.generateTokens(
        user._id.toString(),
        user.email,
        user.username,
        user.role,
      );
      return tokens;
    } catch {
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

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.usersService.updatePassword(userId, newPasswordHash);

    return {
      success: true,
      message: 'Password updated successfully',
    };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const user = await this.usersService.findByVerificationToken(dto.token);
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
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.usersService.setEmailVerificationToken(
      user._id.toString(),
      verificationToken,
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
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await this.usersService.setPasswordResetToken(
      user._id.toString(),
      resetToken,
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
    const user = await this.usersService.findByPasswordResetToken(dto.token);
    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (!user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      throw new BadRequestException('Password reset token has expired');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.usersService.resetPassword(user._id.toString(), newPasswordHash);

    return {
      success: true,
      message: 'Password has been reset successfully',
    };
  }

  private generateTokens(
    userId: string,
    email: string,
    username: string,
    role: string,
  ) {
    const payload = { sub: userId, email, username, role };

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

    const refreshToken = this.jwtService.sign(payload, {
      secret: refreshSecret,
      expiresIn: '7d',
    });

    return { accessToken, refreshToken };
  }
}
