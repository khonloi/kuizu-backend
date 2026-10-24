import { Injectable, UnauthorizedException, Optional } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { UsersService } from '../../users/users.service';
import { RedisService } from '../../../common/redis/redis.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  familyId: string;
}

export interface JwtTokenPayload {
  sub: string;
  email: string;
  username: string;
  role: string;
  sid?: string;
  fid?: string;
  jti?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: string;
  sid?: string;
  fid?: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Optional() private readonly usersService?: UsersService,
    @Optional() private readonly redisService?: RedisService,
  ) {}

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  generateTokens(
    userId: string,
    email: string,
    username: string,
    role: string,
    sessionId?: string,
    familyId?: string,
  ): TokenPair {
    const sid = sessionId || crypto.randomUUID();
    const fid = familyId || sid;
    const payload = { sub: userId, email, username, role, sid, fid };
    const refreshPayload = {
      sub: userId,
      email,
      username,
      role,
      jti: sid,
      fid,
    };

    const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET');
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    if (!accessSecret || !refreshSecret) {
      throw new Error('JWT secrets must be configured in environment');
    }
    const accessExpiresIn =
      this.configService.get<string>('JWT_ACCESS_EXPIRATION') || '15m';
    const refreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '7d';

    const accessToken = this.jwtService.sign(payload, {
      secret: accessSecret,
      expiresIn: accessExpiresIn as any,
    });

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: refreshSecret,
      expiresIn: refreshExpiresIn as any,
    });

    return { accessToken, refreshToken, sessionId: sid, familyId: fid };
  }

  decodeToken<T = JwtTokenPayload>(token: string): T | null {
    try {
      return this.jwtService.decode(token) as T;
    } catch {
      return null;
    }
  }

  extractSessionId(token: string): string | null {
    const payload = this.decodeToken(token);
    return payload?.jti || payload?.sid || null;
  }

  async validatePayload(payload: JwtTokenPayload): Promise<AuthUser> {
    if (this.redisService) {
      if (payload.fid) {
        const isFamilyRevoked = await this.redisService.get<string>(
          `token:revoked:family:${payload.fid}`,
        );
        if (isFamilyRevoked) {
          throw new UnauthorizedException('Token has been revoked');
        }
      }

      if (payload.sid) {
        const isSessionRevoked = await this.redisService.get<string>(
          `token:revoked:session:${payload.sid}`,
        );
        if (isSessionRevoked) {
          throw new UnauthorizedException('Token has been revoked');
        }
      }

      const isUserRevoked = await this.redisService.get<string>(
        `token:revoked:user:${payload.sub}`,
      );
      if (isUserRevoked) {
        throw new UnauthorizedException('Token has been revoked');
      }
    }

    if (this.usersService) {
      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User account no longer exists');
      }
      if (user.isActive === false) {
        throw new UnauthorizedException('User account has been deactivated');
      }

      if (payload.sid && user.sessions?.length) {
        const activeSession = user.sessions.find(
          (s) => s.sessionId === payload.sid,
        );
        if (!activeSession) {
          throw new UnauthorizedException('Session has been revoked');
        }
        if (activeSession.expiresAt && activeSession.expiresAt < new Date()) {
          throw new UnauthorizedException('Session has expired');
        }
      }

      return {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
        role: user.role,
        sid: payload.sid,
      };
    }

    return {
      id: payload.sub,
      email: payload.email,
      username: payload.username,
      role: payload.role,
      sid: payload.sid,
    };
  }

  async verifyAndValidateToken(rawToken?: string): Promise<AuthUser | null> {
    if (!rawToken) return null;
    const token = rawToken.startsWith('Bearer ')
      ? rawToken.slice(7).trim()
      : rawToken.trim();
    if (!token) return null;

    try {
      const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET');
      if (!accessSecret) return null;
      const payload = this.jwtService.verify<JwtTokenPayload>(token, {
        secret: accessSecret,
      });
      return await this.validatePayload(payload);
    } catch {
      return null;
    }
  }
}
