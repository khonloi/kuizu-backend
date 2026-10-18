import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as bcrypt from 'bcryptjs';
import { PasswordService } from './password.service';
import { AUTH_CONSTANTS } from '../../../common/constants';

vi.mock('bcryptjs', () => ({
  hash: vi.fn(),
  compare: vi.fn(),
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PasswordService();
  });

  describe('hashPassword', () => {
    it('should call bcrypt.hash with correct salt rounds', async () => {
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed_pw' as never);

      const result = await service.hashPassword('mySecretPass');
      expect(result).toBe('hashed_pw');
      expect(bcrypt.hash).toHaveBeenCalledWith(
        'mySecretPass',
        AUTH_CONSTANTS.BCRYPT_SALT_ROUNDS,
      );
    });
  });

  describe('comparePassword', () => {
    it('should call bcrypt.compare and return result', async () => {
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const isMatch = await service.comparePassword(
        'mySecretPass',
        'hashed_pw',
      );
      expect(isMatch).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith('mySecretPass', 'hashed_pw');
    });

    it('should return false when passwords do not match', async () => {
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      const isMatch = await service.comparePassword('wrongPass', 'hashed_pw');
      expect(isMatch).toBe(false);
    });
  });

  describe('generateSecureToken', () => {
    it('should generate random hex string of appropriate length', () => {
      const token32 = service.generateSecureToken(32);
      expect(token32).toHaveLength(64);

      const token16 = service.generateSecureToken(16);
      expect(token16).toHaveLength(32);
    });
  });
});
