import { RequestHandler } from 'express';

// Mock redis and rate-limit-redis before importing rateLimiter
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    sendCommand: jest.fn(),
    quit: jest.fn(),
  })),
}));

jest.mock('rate-limit-redis', () => {
  return jest.fn().mockImplementation(() => ({}));
});

jest.mock('../config/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Import after mocks are set up
import {
  apiLimiter,
  authLimiter,
  passwordResetLimiter,
  initRateLimitRedis,
} from '../middleware/rateLimiter';

describe('Rate Limiter Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rate limiter exports', () => {
    it('should export apiLimiter as a function (middleware)', () => {
      expect(apiLimiter).toBeDefined();
      expect(typeof apiLimiter).toBe('function');
    });

    it('should export authLimiter as a function (middleware)', () => {
      expect(authLimiter).toBeDefined();
      expect(typeof authLimiter).toBe('function');
    });

    it('should export passwordResetLimiter as a function (middleware)', () => {
      expect(passwordResetLimiter).toBeDefined();
      expect(typeof passwordResetLimiter).toBe('function');
    });

    it('should export initRateLimitRedis as a function', () => {
      expect(initRateLimitRedis).toBeDefined();
      expect(typeof initRateLimitRedis).toBe('function');
    });
  });

  describe('Rate limiter middleware structure', () => {
    it('apiLimiter should be a valid Express middleware', () => {
      // Express middleware takes 3 arguments: req, res, next
      expect(apiLimiter.length).toBeGreaterThanOrEqual(2);
    });

    it('authLimiter should be a valid Express middleware', () => {
      expect(authLimiter.length).toBeGreaterThanOrEqual(2);
    });

    it('passwordResetLimiter should be a valid Express middleware', () => {
      expect(passwordResetLimiter.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('initRateLimitRedis', () => {
    const originalEnv = process.env.REDIS_URL;

    afterEach(() => {
      if (originalEnv) {
        process.env.REDIS_URL = originalEnv;
      } else {
        delete process.env.REDIS_URL;
      }
    });

    it('should not throw when REDIS_URL is not set', async () => {
      delete process.env.REDIS_URL;

      await expect(initRateLimitRedis()).resolves.not.toThrow();
    });

    it('should attempt Redis connection when REDIS_URL is set', async () => {
      const { createClient } = require('redis');
      process.env.REDIS_URL = 'redis://localhost:6379';

      await initRateLimitRedis();

      expect(createClient).toHaveBeenCalled();
    });
  });

  describe('Rate limiter configuration', () => {
    it('should export all rate limiters as middleware functions', () => {
      // When Redis is not initialized, all limiters return the same fail-closed middleware
      // This is the expected security behavior - we verify they are all defined and callable
      expect(typeof apiLimiter).toBe('function');
      expect(typeof authLimiter).toBe('function');
      expect(typeof passwordResetLimiter).toBe('function');
    });
  });
});
