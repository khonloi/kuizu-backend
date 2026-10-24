import { Injectable, Optional } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { RedisService } from '../../../common/redis/redis.service';
import { TokenService, AuthUser } from '../services/token.service';
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
  private readonly tokenService: TokenService;

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    @Optional() private readonly redisService?: RedisService,
    @Optional() tokenService?: TokenService,
  ) {
    const accessSecret = configService.get<string>('JWT_ACCESS_SECRET');
    if (!accessSecret) {
      throw new Error('JWT_ACCESS_SECRET must be configured in environment');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          let token: string | null = null;
          if (req && req.cookies) {
            token =
              req.cookies['access_token'] ||
              req.cookies['kuizu_session'] ||
              req.cookies['token'] ||
              null;
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

    this.tokenService =
      tokenService ??
      new TokenService(
        undefined as any,
        this.configService,
        this.usersService,
        this.redisService,
      );
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    return this.tokenService.validatePayload(payload);
  }
}
