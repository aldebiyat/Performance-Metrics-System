import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';
import logger from '../config/logger';
import { config } from '../config/constants';

// Create Redis client for rate limiting (optional, falls back to memory)
let redisClient: ReturnType<typeof createClient> | null = null;

export const initRateLimitRedis = async () => {
  if (process.env.REDIS_URL) {
    try {
      redisClient = createClient({ url: process.env.REDIS_URL });

      // Handle Redis connection errors gracefully
      redisClient.on('error', (err) => {
        logger.error('Redis rate limiter error:', { message: err.message });
        // Don't crash - the rate limiter will fall back to memory store
      });

      redisClient.on('reconnecting', () => {
        logger.info('Redis rate limiter reconnecting...');
      });

      await redisClient.connect();
      logger.info('Rate limiter connected to Redis');
    } catch (error) {
      logger.warn('Redis not available, using memory store for rate limiting');
      redisClient = null;
    }
  }
};

const getStore = () => {
  if (redisClient) {
    return new RedisStore({
      sendCommand: (...args: string[]) => redisClient!.sendCommand(args),
    });
  }
  return undefined; // Use default memory store
};

// General API rate limit - configurable requests per window
export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.api.windowMs,
  max: config.rateLimit.api.max,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } },
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore(),
});

// Strict rate limit for auth endpoints - configurable attempts per window
export const authLimiter = rateLimit({
  windowMs: config.rateLimit.auth.windowMs,
  max: config.rateLimit.auth.max,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many login attempts, please try again later' } },
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore(),
  skipSuccessfulRequests: true, // Only count failed attempts
});

// Password reset - configurable attempts per window
export const passwordResetLimiter = rateLimit({
  windowMs: config.rateLimit.passwordReset.windowMs,
  max: config.rateLimit.passwordReset.max,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many password reset requests' } },
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore(),
});
