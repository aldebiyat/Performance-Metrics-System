import { AppError } from '../middleware/errorHandler';

// Mock database module
jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

// Import after mocking
import { query } from '../config/database';
import { adminService } from '../services/adminService';

const mockQuery = query as jest.MockedFunction<typeof query>;

describe('Admin Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getStats (getDashboardStats)', () => {
    it('should return dashboard statistics', async () => {
      // Mock all stats queries
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '25' }] } as any) // total users
        .mockResolvedValueOnce({ rows: [{ count: '20' }] } as any) // active users
        .mockResolvedValueOnce({ rows: [{ count: '50' }] } as any) // total metrics
        .mockResolvedValueOnce({ rows: [{ count: '5' }] } as any)  // total categories
        .mockResolvedValueOnce({ rows: [{ count: '3' }] } as any)  // recent signups
        .mockResolvedValueOnce({                                   // users by role
          rows: [
            { role: 'admin', count: '2' },
            { role: 'editor', count: '8' },
            { role: 'viewer', count: '15' },
          ],
        } as any);

      const stats = await adminService.getStats();

      expect(stats.totalUsers).toBe(25);
      expect(stats.activeUsers).toBe(20);
      expect(stats.totalMetrics).toBe(50);
      expect(stats.totalCategories).toBe(5);
      expect(stats.recentSignups).toBe(3);
      expect(stats.usersByRole).toEqual({
        admin: 2,
        editor: 8,
        viewer: 15,
      });
    });

    it('should handle zero counts', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '0' }] } as any)
        .mockResolvedValueOnce({ rows: [{ count: '0' }] } as any)
        .mockResolvedValueOnce({ rows: [{ count: '0' }] } as any)
        .mockResolvedValueOnce({ rows: [{ count: '0' }] } as any)
        .mockResolvedValueOnce({ rows: [{ count: '0' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const stats = await adminService.getStats();

      expect(stats.totalUsers).toBe(0);
      expect(stats.activeUsers).toBe(0);
      expect(stats.usersByRole).toEqual({
        admin: 0,
        editor: 0,
        viewer: 0,
      });
    });
  });

  describe('getUsers', () => {
    it('should return paginated users', async () => {
      const mockUsers = [
        { id: 1, email: 'user1@example.com', name: 'User 1', role: 'admin', is_active: true },
        { id: 2, email: 'user2@example.com', name: 'User 2', role: 'viewer', is_active: true },
      ];

      // Mock count query
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '25' }] } as any);
      // Mock users query
      mockQuery.mockResolvedValueOnce({ rows: mockUsers } as any);

      const result = await adminService.getUsers(1, 10);

      expect(result.users).toEqual(mockUsers);
      expect(result.total).toBe(25);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(3);
    });

    it('should handle pagination correctly', async () => {
      const mockUsers = [
        { id: 11, email: 'user11@example.com', name: 'User 11', role: 'viewer', is_active: true },
      ];

      mockQuery.mockResolvedValueOnce({ rows: [{ count: '25' }] } as any);
      mockQuery.mockResolvedValueOnce({ rows: mockUsers } as any);

      const result = await adminService.getUsers(2, 10);

      expect(result.page).toBe(2);
      expect(result.users).toEqual(mockUsers);
    });

    it('should filter users by search term', async () => {
      const mockUsers = [
        { id: 1, email: 'john@example.com', name: 'John Doe', role: 'viewer', is_active: true },
      ];

      mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }] } as any);
      mockQuery.mockResolvedValueOnce({ rows: mockUsers } as any);

      const result = await adminService.getUsers(1, 10, 'john');

      expect(result.users).toEqual(mockUsers);
      expect(result.total).toBe(1);

      // Verify search parameter was passed
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.arrayContaining(['%john%'])
      );
    });

    it('should return empty results when no users match', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] } as any);
      mockQuery.mockResolvedValueOnce({ rows: [] } as any);

      const result = await adminService.getUsers(1, 10, 'nonexistent');

      expect(result.users).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'viewer',
        is_active: true,
        email_verified: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockUser] } as any);

      const result = await adminService.getUserById(1);

      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] } as any);

      const result = await adminService.getUserById(999);

      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('should update user role', async () => {
      const mockExistingUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'viewer',
        is_active: true,
      };

      const mockUpdatedUser = {
        ...mockExistingUser,
        role: 'editor',
      };

      // Mock getUserById
      mockQuery.mockResolvedValueOnce({ rows: [mockExistingUser] } as any);
      // Mock update
      mockQuery.mockResolvedValueOnce({ rows: [mockUpdatedUser] } as any);

      const result = await adminService.updateUser(1, { role: 'editor' });

      expect(result.role).toBe('editor');
    });

    it('should update user name', async () => {
      const mockExistingUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Old Name',
        role: 'viewer',
        is_active: true,
      };

      const mockUpdatedUser = {
        ...mockExistingUser,
        name: 'New Name',
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockExistingUser] } as any);
      mockQuery.mockResolvedValueOnce({ rows: [mockUpdatedUser] } as any);

      const result = await adminService.updateUser(1, { name: 'New Name' });

      expect(result.name).toBe('New Name');
    });

    it('should update user is_active status', async () => {
      const mockExistingUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'viewer',
        is_active: true,
      };

      const mockUpdatedUser = {
        ...mockExistingUser,
        is_active: false,
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockExistingUser] } as any);
      mockQuery.mockResolvedValueOnce({ rows: [mockUpdatedUser] } as any);

      const result = await adminService.updateUser(1, { is_active: false });

      expect(result.is_active).toBe(false);
    });

    it('should throw not found error when user does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] } as any);

      try {
        await adminService.updateUser(999, { role: 'admin' });
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(404);
        expect((error as AppError).message).toBe('User not found');
      }
    });

    it('should return existing user when no updates provided', async () => {
      const mockExistingUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'viewer',
        is_active: true,
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockExistingUser] } as any);

      const result = await adminService.updateUser(1, {});

      expect(result).toEqual(mockExistingUser);
      // Should only call getUserById, not the update query
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteUser', () => {
    it('should soft delete user', async () => {
      const mockExistingUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'viewer',
        is_active: true,
      };

      // Mock getUserById
      mockQuery.mockResolvedValueOnce({ rows: [mockExistingUser] } as any);
      // Mock soft delete
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
      // Mock delete refresh tokens
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

      await expect(adminService.deleteUser(1)).resolves.not.toThrow();

      // Verify soft delete was called
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('deleted_at = NOW()'),
        expect.any(Array)
      );
    });

    it('should throw not found error when user does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] } as any);

      try {
        await adminService.deleteUser(999);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(404);
        expect((error as AppError).message).toBe('User not found');
      }
    });

    it('should invalidate all refresh tokens for deleted user', async () => {
      const mockExistingUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'viewer',
        is_active: true,
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockExistingUser] } as any);
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 3 } as any);

      await adminService.deleteUser(1);

      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM refresh_tokens WHERE user_id = $1',
        [1]
      );
    });
  });
});
