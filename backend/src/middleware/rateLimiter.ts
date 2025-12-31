import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';

// Create Redis client for rate limiting (optional, falls back to memory)
let redisClient: ReturnType<typeof createClient> | null = null;

export const initRateLimitRedis = async () => {
  if (process.env.REDIS_URL) {
    try {
      redisClient = createClient({ url: process.env.REDIS_URL });

      // Handle Redis connection errors gracefully
      redisClient.on('error', (err) => {
        console.error('Redis rate limiter error:', err.message);
        // Don't crash - the rate limiter will fall back to memory store
      });

      redisClient.on('reconnecting', () => {
        console.log('Redis rate limiter reconnecting...');
      });

      await redisClient.connect();
      console.log('Rate limiter connected to Redis');
    } catch (error) {
      console.warn('Redis not available, using memory store for rate limiting');
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

// General API rate limit - 100 requests per minute
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } },
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore(),
});

// Strict rate limit for auth endpoints - 5 attempts per minute
export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many login attempts, please try again later' } },
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore(),
  skipSuccessfulRequests: true, // Only count failed attempts
});

// Password reset - 3 attempts per hour
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many password reset requests' } },
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore(),
});
