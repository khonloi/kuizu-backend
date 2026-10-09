import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService: any;
  let mockUsersService: any;
  let mockResponse: any;

  beforeEach(() => {
    mockAuthService = {
      register: vi.fn(),
      login: vi.fn(),
      refreshToken: vi.fn(),
      changePassword: vi.fn(),
      verifyEmail: vi.fn(),
      resendVerification: vi.fn(),
      forgotPassword: vi.fn(),
      resetPassword: vi.fn(),
    };

    mockUsersService = {
      getProfile: vi.fn(),
    };

    mockResponse = {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    };

    controller = new AuthController(mockAuthService, mockUsersService);
  });

  describe('register', () => {
    it('should register a new user and set cookies', async () => {
      const registerDto = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123',
      };
      const authResult = {
        user: { id: 'u1', username: 'testuser' },
        accessToken: 'access_jwt',
        refreshToken: 'refresh_jwt',
      };
      mockAuthService.register.mockResolvedValue(authResult);

      const result = await controller.register(registerDto, mockResponse);

      expect(result).toBe(authResult);
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        'access_jwt',
        expect.any(Object),
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh_jwt',
        expect.any(Object),
      );
    });
  });

  describe('login', () => {
    it('should log in user and set cookies', async () => {
      const loginDto = { emailOrUsername: 'testuser', password: 'password123' };
      const authResult = {
        user: { id: 'u1', username: 'testuser' },
        accessToken: 'access_jwt',
        refreshToken: 'refresh_jwt',
      };
      mockAuthService.login.mockResolvedValue(authResult);

      const result = await controller.login(loginDto, mockResponse);

      expect(result).toBe(authResult);
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        'access_jwt',
        expect.any(Object),
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh_jwt',
        expect.any(Object),
      );
    });
  });

  describe('refresh', () => {
    it('should refresh tokens from request cookie', async () => {
      const req: any = { cookies: { refresh_token: 'cookie_refresh_jwt' } };
      const tokens = { accessToken: 'new_access', refreshToken: 'new_refresh' };
      mockAuthService.refreshToken.mockResolvedValue(tokens);

      const result = await controller.refresh(req, '', mockResponse);

      expect(result).toBe(tokens);
      expect(mockAuthService.refreshToken).toHaveBeenCalledWith(
        'cookie_refresh_jwt',
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        'new_access',
        expect.any(Object),
      );
    });

    it('should refresh tokens from request body if cookie is missing', async () => {
      const req: any = { cookies: {} };
      const tokens = { accessToken: 'new_access', refreshToken: 'new_refresh' };
      mockAuthService.refreshToken.mockResolvedValue(tokens);

      const result = await controller.refresh(
        req,
        'body_refresh_jwt',
        mockResponse,
      );

      expect(result).toBe(tokens);
      expect(mockAuthService.refreshToken).toHaveBeenCalledWith(
        'body_refresh_jwt',
      );
    });
  });

  describe('logout', () => {
    it('should clear cookies and return logout message', async () => {
      const result = await controller.logout(mockResponse);

      expect(mockResponse.clearCookie).toHaveBeenCalledWith('access_token');
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('refresh_token', {
        path: '/api/auth/refresh',
      });
      expect(result).toEqual({
        success: true,
        message: 'Logged out successfully',
      });
    });
  });

  describe('getMe', () => {
    it('should return profile of the current authenticated user', async () => {
      const mockProfile = { id: 'u1', username: 'testuser' };
      mockUsersService.getProfile.mockResolvedValue(mockProfile);

      const result = await controller.getMe('u1');

      expect(result).toBe(mockProfile);
      expect(mockUsersService.getProfile).toHaveBeenCalledWith('u1');
    });
  });

  describe('changePassword', () => {
    it('should change password for current user', async () => {
      const dto = { currentPassword: 'old_pass', newPassword: 'new_pass123' };
      const successResult = {
        success: true,
        message: 'Password updated successfully',
      };
      mockAuthService.changePassword.mockResolvedValue(successResult);

      const result = await controller.changePassword('u1', dto);

      expect(result).toBe(successResult);
      expect(mockAuthService.changePassword).toHaveBeenCalledWith('u1', dto);
    });
  });

  describe('verifyEmail', () => {
    it('should call authService.verifyEmail', async () => {
      const dto = { token: 'verify_token_123' };
      const res = { success: true, message: 'Email successfully verified' };
      mockAuthService.verifyEmail.mockResolvedValue(res);

      const result = await controller.verifyEmail(dto);
      expect(result).toBe(res);
      expect(mockAuthService.verifyEmail).toHaveBeenCalledWith(dto);
    });
  });

  describe('resendVerification', () => {
    it('should call authService.resendVerification', async () => {
      const dto = { email: 'user@example.com' };
      const res = {
        success: true,
        message: 'Verification link has been sent.',
      };
      mockAuthService.resendVerification.mockResolvedValue(res);

      const result = await controller.resendVerification(dto);
      expect(result).toBe(res);
      expect(mockAuthService.resendVerification).toHaveBeenCalledWith(dto);
    });
  });

  describe('forgotPassword', () => {
    it('should call authService.forgotPassword', async () => {
      const dto = { email: 'user@example.com' };
      const res = { success: true, message: 'Reset link sent.' };
      mockAuthService.forgotPassword.mockResolvedValue(res);

      const result = await controller.forgotPassword(dto);
      expect(result).toBe(res);
      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(dto);
    });
  });

  describe('resetPassword', () => {
    it('should call authService.resetPassword', async () => {
      const dto = { token: 'token-123', newPassword: 'new_password123' };
      const res = { success: true, message: 'Password reset.' };
      mockAuthService.resetPassword.mockResolvedValue(res);

      const result = await controller.resetPassword(dto);
      expect(result).toBe(res);
      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(dto);
    });
  });
});
