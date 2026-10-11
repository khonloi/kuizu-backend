import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export interface RequestCorrelationContext {
  correlationId: string;
}

export const correlationStorage =
  new AsyncLocalStorage<RequestCorrelationContext>();

export function getCorrelationId(): string | undefined {
  return correlationStorage.getStore()?.correlationId;
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const rawHeader =
      req.headers['x-request-id'] || req.headers['x-correlation-id'];
    const headerValue = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    const isValid =
      typeof headerValue === 'string' &&
      /^[a-zA-Z0-9_-]{1,64}$/.test(headerValue);
    const correlationId = isValid ? headerValue : randomUUID();

    // Propagate on request and response headers
    req.headers['x-request-id'] = correlationId;
    req.headers['x-correlation-id'] = correlationId;
    res.setHeader('X-Request-Id', correlationId);
    res.setHeader('X-Correlation-Id', correlationId);

    correlationStorage.run({ correlationId }, () => {
      next();
    });
  }
}
