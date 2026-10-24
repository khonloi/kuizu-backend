import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { getAllowedCorsOrigins } from '../../config/cors.util';

@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowedOrigins: string[];

  constructor(private readonly configService: ConfigService) {
    const corsAllowedOrigins = this.configService.get<string>(
      'CORS_ALLOWED_ORIGINS',
    );
    const clientUrl =
      this.configService.get<string>('CLIENT_URL') || 'http://localhost:3001';
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    this.allowedOrigins = getAllowedCorsOrigins(
      corsAllowedOrigins,
      clientUrl,
      isProd,
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method?.toUpperCase();

    // 1. Only enforce on state-changing HTTP methods
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return true;
    }

    // 2. Check if request is authenticated via ambient cookies
    const hasAuthCookie = Boolean(
      request.cookies &&
      (request.cookies['access_token'] ||
        request.cookies['kuizu_session'] ||
        request.cookies['token'] ||
        request.cookies['refresh_token']),
    );

    // If request uses non-cookie credentials (like Bearer token) or is public, bypass origin validation
    if (!hasAuthCookie) {
      return true;
    }

    // 3. Extract request origin from Origin or Referer header
    const originHeader = request.headers['origin'] as string | undefined;
    const refererHeader = request.headers['referer'] as string | undefined;

    let requestOrigin: string | null = null;

    if (originHeader) {
      requestOrigin = originHeader;
    } else if (refererHeader) {
      try {
        const parsed = new URL(refererHeader);
        requestOrigin = parsed.origin;
      } catch {
        throw new ForbiddenException('Invalid Referer header');
      }
    }

    if (!requestOrigin) {
      throw new ForbiddenException(
        'Missing Origin/Referer header for cookie-authenticated mutating request',
      );
    }

    const isAllowed = this.allowedOrigins.includes(requestOrigin);
    if (!isAllowed) {
      throw new ForbiddenException(
        `Cross-site request from untrusted origin '${requestOrigin}' rejected`,
      );
    }

    return true;
  }
}
