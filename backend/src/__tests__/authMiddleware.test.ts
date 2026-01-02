import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  verifyAccessToken,
  verifyRefreshToken,
  authenticate,
  optionalAuth,
  authorize,
} from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { tokenBlacklistService } from '../services/tokenBlacklistService';

// Mock the tokenBlacklistService
jest.mock('../services/tokenBlacklistService', () => ({
  tokenBlacklistService: {
    isBlacklisted: jest.fn(),
    getUserTokensInvalidatedAt: jest.fn(),
    blacklist: jest.fn(),
    invalidateUserTokens: jest.fn(),
  },
}));

const mockedTokenBlacklistService = tokenBlacklistService as jest.Mocked<typeof tokenBlacklistService>;

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('generateAccessToken', () => {
    it('should return a valid JWT string', () => {
      const payload = {
        userId: 1,
        role: 'viewer',
      };

      const token = generateAccessToken(payload);

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should generate token with correct payload', () => {
      const payload = {
        userId: 123,
        role: 'admin',
      };

      const token = generateAccessToken(payload);
      const decoded = jwt.decode(token) as { userId: number; role: string };

      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.role).toBe(payload.role);
    });
  });

  describe('generateRefreshToken', () => {
    it('should return a valid JWT string', () => {
      const payload = {
        userId: 1,
        role: 'viewer',
      };

      const token = generateRefreshToken(payload);

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });
  });

  describe('verifyToken', () => {
    it('should decode a valid token', () => {
      const payload = {
        userId: 42,
        role: 'editor',
      };

      const token = generateAccessToken(payload);
      const decoded = verifyToken(token);

      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.role).toBe(payload.role);
    });

    it('should throw on invalid token', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => verifyToken(invalidToken)).toThrow();
    });

    it('should throw on tampered token', () => {
      const payload = {
        userId: 1,
        role: 'viewer',
      };

      const token = generateAccessToken(payload);
      const tamperedToken = token.slice(0, -5) + 'xxxxx';

      expect(() => verifyToken(tamperedToken)).toThrow();
    });

    it('should throw on empty token', () => {
      expect(() => verifyToken('')).toThrow();
    });
  });

  describe('authenticate middleware', () => {
    it('should throw without authorization header', async () => {
      mockRequest.headers = {};

      await expect(
        authenticate(mockRequest as Request, mockResponse as Response, mockNext)
      ).rejects.toThrow(AppError);

      try {
        await authenticate(mockRequest as Request, mockResponse as Response, mockNext);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(401);
        expect((error as AppError).message).toBe('No token provided');
      }
    });

    it('should throw with invalid token format (no Bearer prefix)', async () => {
      mockRequest.headers = {
        authorization: 'InvalidPrefix sometoken',
      };

      await expect(
        authenticate(mockRequest as Request, mockResponse as Response, mockNext)
      ).rejects.toThrow(AppError);

      try {
        await authenticate(mockRequest as Request, mockResponse as Response, mockNext);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(401);
        expect((error as AppError).message).toBe('No token provided');
      }
    });

    it('should throw with invalid token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid.token.here',
      };

      await expect(
        authenticate(mockRequest as Request, mockResponse as Response, mockNext)
      ).rejects.toThrow(AppError);

      try {
        await authenticate(mockRequest as Request, mockResponse as Response, mockNext);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(401);
        expect((error as AppError).message).toBe('Invalid or expired token');
      }
    });

    it('should set user on request with valid token', async () => {
      const payload = {
        userId: 100,
        role: 'admin',
      };

      const token = generateAccessToken(payload);
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user?.userId).toBe(payload.userId);
      expect(mockRequest.user?.role).toBe(payload.role);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('optionalAuth middleware', () => {
    beforeEach(() => {
      // Reset mocks before each test
      mockedTokenBlacklistService.isBlacklisted.mockReset();
      mockedTokenBlacklistService.getUserTokensInvalidatedAt.mockReset();
      // Default: no blacklist, no invalidation
      mockedTokenBlacklistService.isBlacklisted.mockResolvedValue(false);
      mockedTokenBlacklistService.getUserTokensInvalidatedAt.mockResolvedValue(null);
    });

    it('should call next without setting user when no token provided', async () => {
      mockRequest.headers = {};

      await optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should set user when valid non-blacklisted token provided', async () => {
      const payload = {
        userId: 50,
        role: 'viewer',
      };

      const token = generateAccessToken(payload);
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      await optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user?.userId).toBe(payload.userId);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next without setting user when invalid token provided', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid.token.here',
      };

      await optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should not set user when token is blacklisted', async () => {
      const payload = {
        userId: 50,
        role: 'viewer',
      };

      const token = generateAccessToken(payload);
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      // Mock the token as blacklisted
      mockedTokenBlacklistService.isBlacklisted.mockResolvedValue(true);

      await optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      // Verify blacklist was checked with token hash
      const expectedHash = crypto.createHash('sha256').update(token).digest('hex').substring(0, 16);
      expect(mockedTokenBlacklistService.isBlacklisted).toHaveBeenCalledWith(expectedHash);
    });

    it('should not set user when user tokens have been invalidated', async () => {
      const payload = {
        userId: 50,
        role: 'viewer',
      };

      const token = generateAccessToken(payload);
      const decoded = jwt.decode(token) as { iat: number };
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      // Mock user tokens invalidated after this token was issued
      const invalidatedAt = (decoded.iat * 1000) + 1000; // 1 second after token issued
      mockedTokenBlacklistService.getUserTokensInvalidatedAt.mockResolvedValue(invalidatedAt);

      await optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockedTokenBlacklistService.getUserTokensInvalidatedAt).toHaveBeenCalledWith(payload.userId);
    });

    it('should set user when token was issued after invalidation', async () => {
      const payload = {
        userId: 50,
        role: 'viewer',
      };

      const token = generateAccessToken(payload);
      const decoded = jwt.decode(token) as { iat: number };
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      // Mock user tokens invalidated before this token was issued
      const invalidatedAt = (decoded.iat * 1000) - 1000; // 1 second before token issued
      mockedTokenBlacklistService.getUserTokensInvalidatedAt.mockResolvedValue(invalidatedAt);

      await optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user?.userId).toBe(payload.userId);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('authorize middleware', () => {
    it('should throw if user not authenticated', () => {
      mockRequest.user = undefined;

      const authorizeMiddleware = authorize('admin', 'editor');

      expect(() =>
        authorizeMiddleware(mockRequest as Request, mockResponse as Response, mockNext)
      ).toThrow(AppError);

      try {
        authorizeMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(401);
        expect((error as AppError).message).toBe('Not authenticated');
      }
    });

    it('should throw if role not in allowed roles', () => {
      mockRequest.user = {
        userId: 1,
        role: 'viewer',
      };

      const authorizeMiddleware = authorize('admin', 'editor');

      expect(() =>
        authorizeMiddleware(mockRequest as Request, mockResponse as Response, mockNext)
      ).toThrow(AppError);

      try {
        authorizeMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(403);
        expect((error as AppError).message).toBe('Insufficient permissions');
      }
    });

    it('should call next if role is allowed', () => {
      mockRequest.user = {
        userId: 1,
        role: 'admin',
      };

      const authorizeMiddleware = authorize('admin', 'editor');
      authorizeMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should work with single role', () => {
      mockRequest.user = {
        userId: 1,
        role: 'editor',
      };

      const authorizeMiddleware = authorize('editor');
      authorizeMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should work with multiple allowed roles', () => {
      mockRequest.user = {
        userId: 1,
        role: 'viewer',
      };

      const authorizeMiddleware = authorize('admin', 'editor', 'viewer');
      authorizeMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Token Secret Separation', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = {
        ...originalEnv,
        JWT_SECRET: 'access-secret-key-for-testing',
        JWT_REFRESH_SECRET: 'refresh-secret-key-for-testing'
      };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should use different secrets for access and refresh tokens', () => {
      const payload = { userId: 1, role: 'viewer' };

      const accessToken = generateAccessToken(payload);
      const refreshToken = generateRefreshToken(payload);

      // Tokens should be different (different secrets produce different signatures)
      expect(accessToken).not.toBe(refreshToken);

      // Access token should verify with access secret
      expect(() => verifyAccessToken(accessToken)).not.toThrow();

      // Refresh token should verify with refresh secret
      expect(() => verifyRefreshToken(refreshToken)).not.toThrow();

      // Cross-verification should fail
      expect(() => verifyRefreshToken(accessToken)).toThrow();
      expect(() => verifyAccessToken(refreshToken)).toThrow();
    });

    it('should use explicit HS256 algorithm', () => {
      const payload = { userId: 1, role: 'viewer' };

      const accessToken = generateAccessToken(payload);
      const refreshToken = generateRefreshToken(payload);

      // Decode tokens to check the header
      const accessHeader = JSON.parse(Buffer.from(accessToken.split('.')[0], 'base64').toString());
      const refreshHeader = JSON.parse(Buffer.from(refreshToken.split('.')[0], 'base64').toString());

      expect(accessHeader.alg).toBe('HS256');
      expect(refreshHeader.alg).toBe('HS256');
    });

    it('verifyToken should be alias for verifyAccessToken', () => {
      const payload = { userId: 1, role: 'viewer' };
      const accessToken = generateAccessToken(payload);

      // Both should work the same way
      const decoded1 = verifyToken(accessToken);
      const decoded2 = verifyAccessToken(accessToken);

      expect(decoded1.userId).toBe(decoded2.userId);
      expect(decoded1.role).toBe(decoded2.role);
    });
  });
});
