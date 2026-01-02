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

// Flag to track if Redis is available for rate limiting
let redisAvailable = false;

/**
 * Middleware that fails closed when Redis is unavailable.
 * Returns 503 Service Unavailable instead of allowing requests through
 * with an ineffective in-memory store.
 */
const failClosedMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!redisAvailable) {
    logger.error('CRITICAL: Rate limiter Redis unavailable - rejecting request for security');
    return res.status(503).json({
      success: false,
      error: 'Service temporarily unavailable. Please try again later.',
    });
  }
  next();
};

/**
 * Creates a rate limiter that fails closed when Redis is unavailable.
 * Wraps express-rate-limit with a fail-closed check.
 */
const createFailClosedRateLimiter = (options: Parameters<typeof rateLimit>[0]) => {
  const store = getStore();

  if (store === null) {
    redisAvailable = false;
    logger.warn('SECURITY WARNING: Rate limiter Redis unavailable. Requests will be rejected with 503.');
    return failClosedMiddleware;
  }

  redisAvailable = true;
  return rateLimit({
    ...options,
    store,
  });
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
