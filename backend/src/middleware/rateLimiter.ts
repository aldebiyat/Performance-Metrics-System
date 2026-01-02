import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';
import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import { config } from '../config/constants';

// Create Redis client for rate limiting (required for production - fails closed if unavailable)
let redisClient: ReturnType<typeof createClient> | null = null;

export const initRateLimitRedis = async () => {
  if (process.env.REDIS_URL) {
    try {
      redisClient = createClient({ url: process.env.REDIS_URL });

      // Handle Redis connection errors gracefully
      redisClient.on('error', (err) => {
        logger.error('Redis rate limiter error:', { message: err.message });
        // Don't crash on transient errors - Redis client will attempt to reconnect
      });

      redisClient.on('reconnecting', () => {
        logger.info('Redis rate limiter reconnecting...');
      });

      await redisClient.connect();
      logger.info('Rate limiter connected to Redis');
    } catch (error) {
      logger.error('Redis not available for rate limiting - requests will be rejected with 503');
      redisClient = null;
    }
  }
};

const getStore = (): RedisStore | null => {
  if (redisClient) {
    return new RedisStore({
      sendCommand: (...args: string[]) => redisClient!.sendCommand(args),
    });
  }
  // Return null to signal Redis is unavailable - rate limiter should fail-closed
  return null;
};

// Log throttling to prevent log spam when Redis is down
let lastRedisUnavailableLogTime = 0;
const LOG_THROTTLE_MS = 60000; // Log once per minute max

/**
 * Middleware that fails closed when Redis is unavailable.
 * Checks Redis availability at REQUEST time, not module load time.
 * Returns 503 Service Unavailable instead of allowing requests through
 * with an ineffective in-memory store.
 */
const redisAvailabilityCheck = (req: Request, res: Response, next: NextFunction) => {
  if (!redisClient || !redisClient.isOpen) {
    const now = Date.now();
    // Throttle logging to prevent log spam under high load
    if (now - lastRedisUnavailableLogTime >= LOG_THROTTLE_MS) {
      logger.error('CRITICAL: Rate limiter Redis unavailable - rejecting requests for security');
      lastRedisUnavailableLogTime = now;
    }
    return res.status(503).json({
      success: false,
      error: 'Service temporarily unavailable. Please try again later.',
    });
  }
  next();
};

/**
 * Creates a rate limiter that fails closed when Redis is unavailable.
 * Chains redisAvailabilityCheck (checks at request time) with the actual rate limiter.
 * This ensures Redis availability is checked per-request, not at module load time.
 */
const createFailClosedRateLimiter = (options: Parameters<typeof rateLimit>[0]) => {
  // Create the rate limiter - it will use Redis store if available at request time
  const limiter = rateLimit({
    ...options,
    store: {
      // Dynamic store that creates RedisStore on demand
      init: () => {},
      get: async (key: string) => {
        const store = getStore();
        if (!store) return undefined;
        return store.get?.(key);
      },
      increment: async (key: string) => {
        const store = getStore();
        if (!store) return { totalHits: 0, resetTime: new Date() };
        return store.increment(key);
      },
      decrement: async (key: string) => {
        const store = getStore();
        if (!store) return;
        return store.decrement?.(key);
      },
      resetKey: async (key: string) => {
        const store = getStore();
        if (!store) return;
        return store.resetKey?.(key);
      },
    },
  });

  // Chain: first check Redis availability, then apply rate limit
  return [redisAvailabilityCheck, limiter];
};

// General API rate limit - configurable requests per window
export const apiLimiter = createFailClosedRateLimiter({
  windowMs: config.rateLimit.api.windowMs,
  max: config.rateLimit.api.max,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limit for auth endpoints - configurable attempts per window
export const authLimiter = createFailClosedRateLimiter({
  windowMs: config.rateLimit.auth.windowMs,
  max: config.rateLimit.auth.max,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many login attempts, please try again later' } },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed attempts
});

// Password reset - configurable attempts per window
export const passwordResetLimiter = createFailClosedRateLimiter({
  windowMs: config.rateLimit.passwordReset.windowMs,
  max: config.rateLimit.passwordReset.max,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many password reset requests' } },
  standardHeaders: true,
  legacyHeaders: false,
});
