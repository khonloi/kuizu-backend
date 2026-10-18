import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TokenService } from './token.service';

describe('TokenService', () => {
  let service: TokenService;
  let mockJwtService: any;
  let mockConfigService: any;

  beforeEach(() => {
    mockJwtService = {
      sign: vi.fn().mockImplementation((payload) => `signed_${payload.sub}`),
      decode: vi.fn(),
    };

    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'JWT_ACCESS_SECRET') return 'custom_access_secret';
        if (key === 'JWT_REFRESH_SECRET') return 'custom_refresh_secret';
        if (key === 'JWT_ACCESS_EXPIRATION') return '10m';
        if (key === 'JWT_REFRESH_EXPIRATION') return '5d';
        return null;
      }),
    };

    service = new TokenService(mockJwtService, mockConfigService);
  });

  describe('hashToken', () => {
    it('should hash a token using sha256', () => {
      const hash1 = service.hashToken('test-token');
      const hash2 = service.hashToken('test-token');
      const hash3 = service.hashToken('other-token');

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash1).toHaveLength(64);
    });
  });

  describe('generateTokens', () => {
    it('should generate accessToken, refreshToken, and new sessionId', () => {
      const result = service.generateTokens(
        'user-1',
        'u@example.com',
        'u1',
        'user',
      );

      expect(result.accessToken).toBe('signed_user-1');
      expect(result.refreshToken).toBe('signed_user-1');
      expect(result.sessionId).toBeDefined();
      expect(mockJwtService.sign).toHaveBeenCalledTimes(2);
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'user-1', email: 'u@example.com' }),
        { secret: 'custom_access_secret', expiresIn: '10m' },
      );
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'user-1', jti: result.sessionId }),
        { secret: 'custom_refresh_secret', expiresIn: '5d' },
      );
    });

    it('should reuse existing sessionId when provided', () => {
      const result = service.generateTokens(
        'user-1',
        'u@example.com',
        'u1',
        'user',
        'existing-session-123',
      );

      expect(result.sessionId).toBe('existing-session-123');
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sid: 'existing-session-123' }),
        expect.any(Object),
      );
    });

    it('should fallback to defaults when config values are missing', () => {
      mockConfigService.get.mockReturnValue(null);
      const result = service.generateTokens(
        'user-2',
        'u2@example.com',
        'u2',
        'admin',
      );

      expect(result.accessToken).toBe('signed_user-2');
      expect(mockJwtService.sign).toHaveBeenCalledWith(expect.anything(), {
        secret: 'kuizu_super_secret_access_key_2026',
        expiresIn: '15m',
      });
    });
  });

  describe('decodeToken', () => {
    it('should return decoded payload', () => {
      mockJwtService.decode.mockReturnValue({ sub: 'u-1', sid: 'sess-1' });
      const decoded = service.decodeToken('token-abc');

      expect(decoded).toEqual({ sub: 'u-1', sid: 'sess-1' });
      expect(mockJwtService.decode).toHaveBeenCalledWith('token-abc');
    });

    it('should return null when decoding throws an error', () => {
      mockJwtService.decode.mockImplementation(() => {
        throw new Error('invalid token');
      });

      const decoded = service.decodeToken('bad-token');
      expect(decoded).toBeNull();
    });
  });

  describe('extractSessionId', () => {
    it('should extract jti first', () => {
      mockJwtService.decode.mockReturnValue({ jti: 'jti-123', sid: 'sid-456' });
      expect(service.extractSessionId('tok')).toBe('jti-123');
    });

    it('should extract sid if jti is not present', () => {
      mockJwtService.decode.mockReturnValue({ sid: 'sid-456' });
      expect(service.extractSessionId('tok')).toBe('sid-456');
    });

    it('should return null if neither jti nor sid is present', () => {
      mockJwtService.decode.mockReturnValue({ sub: 'u-1' });
      expect(service.extractSessionId('tok')).toBeNull();
    });
  });
});
