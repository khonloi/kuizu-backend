import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminUsersController } from './admin-users.controller';

describe('AdminUsersController', () => {
  let controller: AdminUsersController;
  let mockUsersService: any;

  beforeEach(() => {
    mockUsersService = {
      findAllAdmin: vi.fn(),
      findAdminUserById: vi.fn(),
      updateUserRole: vi.fn(),
      updateUserStatus: vi.fn(),
      deleteAccount: vi.fn(),
    };

    controller = new AdminUsersController(mockUsersService);
  });

  describe('getUsers', () => {
    it('should call usersService.findAllAdmin with query', async () => {
      const mockResult = {
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      };
      mockUsersService.findAllAdmin.mockResolvedValue(mockResult);

      const query = { page: 1, limit: 20, role: 'user' as const };
      const result = await controller.getUsers(query);

      expect(result).toBe(mockResult);
      expect(mockUsersService.findAllAdmin).toHaveBeenCalledWith(query);
    });
  });

  describe('getUserById', () => {
    it('should call usersService.findAdminUserById with id', async () => {
      const mockUser = { id: 'u1', username: 'bob', email: 'bob@example.com' };
      mockUsersService.findAdminUserById.mockResolvedValue(mockUser);

      const result = await controller.getUserById('u1');
      expect(result).toBe(mockUser);
      expect(mockUsersService.findAdminUserById).toHaveBeenCalledWith('u1');
    });
  });

  describe('updateUserRole', () => {
    it('should call usersService.updateUserRole with id and role', async () => {
      const updatedUser = { id: 'u1', role: 'teacher' };
      mockUsersService.updateUserRole.mockResolvedValue(updatedUser);

      const result = await controller.updateUserRole('u1', { role: 'teacher' });
      expect(result).toBe(updatedUser);
      expect(mockUsersService.updateUserRole).toHaveBeenCalledWith(
        'u1',
        'teacher',
      );
    });
  });

  describe('updateUserStatus', () => {
    it('should call usersService.updateUserStatus with id and isActive', async () => {
      const updatedUser = { id: 'u1', isActive: false };
      mockUsersService.updateUserStatus.mockResolvedValue(updatedUser);

      const result = await controller.updateUserStatus('u1', {
        isActive: false,
      });
      expect(result).toBe(updatedUser);
      expect(mockUsersService.updateUserStatus).toHaveBeenCalledWith(
        'u1',
        false,
      );
    });
  });

  describe('deleteUser', () => {
    it('should call usersService.deleteAccount with id', async () => {
      const deleteResult = {
        success: true,
        message: 'Account deleted successfully',
      };
      mockUsersService.deleteAccount.mockResolvedValue(deleteResult);

      const result = await controller.deleteUser('u1');
      expect(result).toBe(deleteResult);
      expect(mockUsersService.deleteAccount).toHaveBeenCalledWith('u1');
    });
  });
});
