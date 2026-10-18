import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

export interface JwtTokenPayload {
  sub: string;
  email: string;
  username: string;
  role: string;
  sid?: string;
  jti?: string;
  [key: string]: unknown;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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
  ): TokenPair {
    const sid = sessionId || crypto.randomUUID();
    const payload = { sub: userId, email, username, role, sid };
    const refreshPayload = { sub: userId, email, username, role, jti: sid };

    const accessSecret =
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      'kuizu_super_secret_access_key_2026';
    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      'kuizu_super_secret_refresh_key_2026';
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

    return { accessToken, refreshToken, sessionId: sid };
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
}
