import { describe, it, expect, vi } from 'vitest';
import {
  CorrelationIdMiddleware,
  getCorrelationId,
} from './correlation-id.middleware';

describe('CorrelationIdMiddleware', () => {
  const middleware = new CorrelationIdMiddleware();

  it('should generate a new correlation ID if none exists in headers', () => {
    const req: any = {
      headers: {},
    };

    const mockSetHeader = vi.fn();
    const res: any = {
      setHeader: mockSetHeader,
    };

    let capturedInContext: string | undefined;

    middleware.use(req, res, () => {
      capturedInContext = getCorrelationId();
    });

    const generatedId = req.headers['x-request-id'] as string;
    expect(generatedId).toBeDefined();
    expect(typeof generatedId).toBe('string');
    expect(generatedId.length).toBeGreaterThan(10);
    expect(req.headers['x-correlation-id']).toBe(generatedId);
    expect(mockSetHeader).toHaveBeenCalledWith('X-Request-Id', generatedId);
    expect(mockSetHeader).toHaveBeenCalledWith('X-Correlation-Id', generatedId);
    expect(capturedInContext).toBe(generatedId);
  });

  it('should preserve and propagate existing x-request-id header', () => {
    const existingId = 'existing-client-req-id-789';
    const req: any = {
      headers: {
        'x-request-id': existingId,
      },
    };

    const mockSetHeader = vi.fn();
    const res: any = {
      setHeader: mockSetHeader,
    };

    let capturedInContext: string | undefined;

    middleware.use(req, res, () => {
      capturedInContext = getCorrelationId();
    });

    expect(req.headers['x-request-id']).toBe(existingId);
    expect(req.headers['x-correlation-id']).toBe(existingId);
    expect(mockSetHeader).toHaveBeenCalledWith('X-Request-Id', existingId);
    expect(mockSetHeader).toHaveBeenCalledWith('X-Correlation-Id', existingId);
    expect(capturedInContext).toBe(existingId);
  });

  it('should preserve and propagate existing x-correlation-id header', () => {
    const existingId = 'existing-correlation-456';
    const req: any = {
      headers: {
        'x-correlation-id': existingId,
      },
    };

    const mockSetHeader = vi.fn();
    const res: any = {
      setHeader: mockSetHeader,
    };

    let capturedInContext: string | undefined;

    middleware.use(req, res, () => {
      capturedInContext = getCorrelationId();
    });

    expect(req.headers['x-request-id']).toBe(existingId);
    expect(mockSetHeader).toHaveBeenCalledWith('X-Request-Id', existingId);
    expect(capturedInContext).toBe(existingId);
  });

  it('should return undefined when getCorrelationId is called outside context', () => {
    expect(getCorrelationId()).toBeUndefined();
  });
});
