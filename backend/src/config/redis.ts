import { createClient } from 'redis';
import logger from './logger';

export type RedisClientType = ReturnType<typeof createClient>;

let redisClient: RedisClientType | null = null;

export const getRedisClient = (): RedisClientType | null => redisClient;

/**
 * Build Redis URL with password if provided
 * If REDIS_PASSWORD is set and URL doesn't already contain a password, add it
 */
const buildRedisUrl = (): string | undefined => {
  const baseUrl = process.env.REDIS_URL;
  const password = process.env.REDIS_PASSWORD;

  if (!baseUrl) {
    return undefined;
  }

  // If password is provided and URL doesn't already have one, add it
  if (password) {
    try {
      const url = new URL(baseUrl);
      // Only add password if not already present in URL
      if (!url.password) {
        url.password = password;
        return url.toString();
      }
    } catch {
      // If URL parsing fails, try simple string manipulation
      // Handle redis://host:port format
      if (baseUrl.startsWith('redis://') && !baseUrl.includes('@')) {
        return baseUrl.replace('redis://', `redis://:${password}@`);
      }
    }
  }

  return baseUrl;
};

export const initRedis = async (): Promise<void> => {
  const redisUrl = buildRedisUrl();

  if (!redisUrl) {
    logger.info('REDIS_URL not set, using memory cache');
    return;
  }

  try {
    const useTLS = process.env.REDIS_TLS === 'true';

    redisClient = createClient({
      url: redisUrl,
      socket: useTLS ? {
        tls: true,
        rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false',
      } : undefined,
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error', { error: err.message });
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });

    await redisClient.connect();
    logger.info('Connected to Redis');
  } catch (error) {
    logger.warn('Failed to connect to Redis, using memory cache', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    redisClient = null;
  }
};

export const closeRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
};
