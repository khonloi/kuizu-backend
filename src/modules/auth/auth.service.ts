import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';

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

    const existingUsername = await this.usersService.findByUsername(dto.username);
    if (existingUsername) {
      throw new ConflictException('Username already taken');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.usersService.create({
      email: dto.email.toLowerCase(),
      username: dto.username,
      passwordHash,
      role: 'user',
    });

    const tokens = this.generateTokens(user._id.toString(), user.email, user.username, user.role);

    return {
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
        xp: user.xp,
        streak: user.streak,
        hearts: user.hearts,
        gems: user.gems,
        league: user.league,
      },
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

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = this.generateTokens(user._id.toString(), user.email, user.username, user.role);

    return {
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
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
      const payload = this.jwtService.verify(refreshToken, { secret: refreshSecret });

      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const tokens = this.generateTokens(user._id.toString(), user.email, user.username, user.role);
      return tokens;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private generateTokens(userId: string, email: string, username: string, role: string) {
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
