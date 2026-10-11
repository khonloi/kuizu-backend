import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { Request } from 'express';

export interface JwtPayload {
  sub: string;
  email: string;
  username: string;
  role: string;
  sid?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    const accessSecret =
      configService.get<string>('JWT_ACCESS_SECRET') ||
      'kuizu_super_secret_access_key_2026';

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          let token: string | null = null;
          if (req && req.cookies) {
            token = req.cookies['access_token'];
          }
          if (!token && req.headers?.authorization) {
            const parts = req.headers.authorization.split(' ');
            if (parts.length === 2 && parts[0] === 'Bearer') {
              token = parts[1];
            }
          }
          return token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: accessSecret,
    });
  }

  async validate(payload: JwtPayload) {
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
}
