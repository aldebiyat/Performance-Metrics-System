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
    it('should export apiLimiter as middleware array (Redis check + rate limiter)', () => {
      expect(apiLimiter).toBeDefined();
      expect(Array.isArray(apiLimiter)).toBe(true);
      expect(apiLimiter.length).toBe(2);
      expect(typeof apiLimiter[0]).toBe('function');
      expect(typeof apiLimiter[1]).toBe('function');
    });

    it('should export authLimiter as middleware array (Redis check + rate limiter)', () => {
      expect(authLimiter).toBeDefined();
      expect(Array.isArray(authLimiter)).toBe(true);
      expect(authLimiter.length).toBe(2);
      expect(typeof authLimiter[0]).toBe('function');
      expect(typeof authLimiter[1]).toBe('function');
    });

    it('should export passwordResetLimiter as middleware array (Redis check + rate limiter)', () => {
      expect(passwordResetLimiter).toBeDefined();
      expect(Array.isArray(passwordResetLimiter)).toBe(true);
      expect(passwordResetLimiter.length).toBe(2);
      expect(typeof passwordResetLimiter[0]).toBe('function');
      expect(typeof passwordResetLimiter[1]).toBe('function');
    });

    it('should export initRateLimitRedis as a function', () => {
      expect(initRateLimitRedis).toBeDefined();
      expect(typeof initRateLimitRedis).toBe('function');
    });
  });

  describe('Rate limiter middleware structure', () => {
    it('apiLimiter should contain valid Express middleware functions', () => {
      // Each middleware in array takes 3 arguments: req, res, next
      expect(apiLimiter[0].length).toBeGreaterThanOrEqual(2);
    });

    it('authLimiter should contain valid Express middleware functions', () => {
      expect(authLimiter[0].length).toBeGreaterThanOrEqual(2);
    });

    it('passwordResetLimiter should contain valid Express middleware functions', () => {
      expect(passwordResetLimiter[0].length).toBeGreaterThanOrEqual(2);
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
    it('should export all rate limiters as middleware arrays', () => {
      // Rate limiters are now arrays: [redisAvailabilityCheck, rateLimiter]
      // This ensures Redis availability is checked at request time, not module load time
      expect(Array.isArray(apiLimiter)).toBe(true);
      expect(Array.isArray(authLimiter)).toBe(true);
      expect(Array.isArray(passwordResetLimiter)).toBe(true);
    });
  });
});
