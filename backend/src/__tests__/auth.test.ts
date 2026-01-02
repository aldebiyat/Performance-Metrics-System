import bcrypt from 'bcrypt';
import { AppError } from '../middleware/errorHandler';

// Mock database module
const mockTxQuery = jest.fn();
jest.mock('../config/database', () => ({
  query: jest.fn(),
  withTransaction: jest.fn((callback) => {
    // Create a mock client object
    const mockClient = {};
    return callback(mockClient);
  }),
  createTransactionalQuery: jest.fn(() => mockTxQuery),
}));

// Mock email service
jest.mock('../services/emailService', () => ({
  emailService: {
    sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  },
}));

// Import after mocking
import { query } from '../config/database';
import { authService } from '../services/authService';
import { generateAccessToken, verifyToken } from '../middleware/auth';

const mockQuery = query as jest.MockedFunction<typeof query>;

describe('Auth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTxQuery.mockReset();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const email = 'test@example.com';
      const password = 'securePassword123';
      const name = 'Test User';

      // Mock: no existing user (outside transaction)
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      // Mock: insert user (inside transaction)
      mockTxQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          email: email.toLowerCase(),
          name,
          role: 'viewer',
          is_active: true,
          email_verified: false,
          created_at: new Date(),
          updated_at: new Date(),
        }],
        rowCount: 1,
      } as any);

      // Mock: insert refresh token (inside transaction)
      mockTxQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

      // Mock: cleanup expired tokens (inside transaction)
      mockTxQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const result = await authService.register(email, password, name);

      expect(result.user.email).toBe(email.toLowerCase());
      expect(result.user.name).toBe(name);
      expect(result.user.role).toBe('viewer');
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
    });

    it('should throw conflict error when email already exists', async () => {
      const email = 'existing@example.com';
      const password = 'securePassword123';

      // Mock: existing user found
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1 }],
        rowCount: 1,
      } as any);

      try {
        await authService.register(email, password);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(409);
        expect((error as AppError).message).toBe('Email already registered');
      }
    });

    it('should throw validation error for weak password', async () => {
      const email = 'test@example.com';
      const password = 'short'; // Less than 8 characters

      // Mock: no existing user
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      try {
        await authService.register(email, password);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(422);
        expect((error as AppError).message).toBe('Password must be at least 8 characters');
      }
    });
  });

  describe('login', () => {
    it('should login successfully with correct credentials', async () => {
      const email = 'test@example.com';
      const password = 'correctPassword123';
      const passwordHash = await bcrypt.hash(password, 12);

      // Mock: user found
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          email: email.toLowerCase(),
          password_hash: passwordHash,
          name: 'Test User',
          role: 'viewer',
          is_active: true,
        }],
        rowCount: 1,
      } as any);

      // Mock: insert refresh token
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

      // Mock: cleanup expired tokens
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const result = await authService.login(email, password);

      expect(result.user.email).toBe(email.toLowerCase());
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      expect((result.user as any).password_hash).toBeUndefined();
    });

    it('should throw unauthorized error for invalid email', async () => {
      const email = 'nonexistent@example.com';
      const password = 'anyPassword123';

      // Mock: no user found
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      try {
        await authService.login(email, password);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(401);
        expect((error as AppError).message).toBe('Invalid email or password');
      }
    });

    it('should throw unauthorized error for invalid password', async () => {
      const email = 'test@example.com';
      const correctPassword = 'correctPassword123';
      const wrongPassword = 'wrongPassword123';
      const passwordHash = await bcrypt.hash(correctPassword, 12);

      // Mock: user found
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          email: email.toLowerCase(),
          password_hash: passwordHash,
          name: 'Test User',
          role: 'viewer',
          is_active: true,
        }],
        rowCount: 1,
      } as any);

      try {
        await authService.login(email, wrongPassword);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(401);
        expect((error as AppError).message).toBe('Invalid email or password');
      }
    });

    it('should throw unauthorized error for deactivated account', async () => {
      const email = 'deactivated@example.com';
      const password = 'anyPassword123';
      const passwordHash = await bcrypt.hash(password, 12);

      // Mock: deactivated user found
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          email: email.toLowerCase(),
          password_hash: passwordHash,
          name: 'Deactivated User',
          role: 'viewer',
          is_active: false,
        }],
        rowCount: 1,
      } as any);

      try {
        await authService.login(email, password);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(401);
        expect((error as AppError).message).toBe('Account is deactivated');
      }
    });
  });

  describe('token verification', () => {
    it('should generate and verify valid access token', () => {
      const payload = {
        userId: 1,
        email: 'test@example.com',
        role: 'viewer',
      };

      const token = generateAccessToken(payload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = verifyToken(token);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
    });

    it('should throw error for invalid token', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => verifyToken(invalidToken)).toThrow();
    });

    it('should throw error for tampered token', () => {
      const payload = {
        userId: 1,
        email: 'test@example.com',
        role: 'viewer',
      };

      const token = generateAccessToken(payload);
      const tamperedToken = token.slice(0, -5) + 'xxxxx';

      expect(() => verifyToken(tamperedToken)).toThrow();
    });
  });

  describe('getCurrentUser', () => {
    it('should return user when found', async () => {
      const userId = 1;

      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: userId,
          email: 'test@example.com',
          name: 'Test User',
          role: 'viewer',
          is_active: true,
          email_verified: true,
          created_at: new Date(),
          updated_at: new Date(),
        }],
        rowCount: 1,
      } as any);

      const result = await authService.getCurrentUser(userId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(userId);
      expect(result?.email).toBe('test@example.com');
    });

    it('should return null when user not found', async () => {
      const userId = 999;

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const result = await authService.getCurrentUser(userId);

      expect(result).toBeNull();
    });
  });

  describe('logout', () => {
    it('should delete refresh token on logout', async () => {
      const refreshToken = 'some-refresh-token';

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

      await expect(authService.logout(refreshToken)).resolves.not.toThrow();
      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM refresh_tokens WHERE token_hash = $1',
        expect.any(Array)
      );
    });
  });

  describe('logoutAll', () => {
    it('should delete all refresh tokens for user', async () => {
      const userId = 1;

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 3 } as any);

      await expect(authService.logoutAll(userId)).resolves.not.toThrow();
      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM refresh_tokens WHERE user_id = $1',
        [userId]
      );
    });
  });
});
