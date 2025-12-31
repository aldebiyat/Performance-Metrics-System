import { createClient } from 'redis';
import logger from './logger';

export type RedisClientType = ReturnType<typeof createClient>;

let redisClient: RedisClientType | null = null;

export const getRedisClient = (): RedisClientType | null => redisClient;

export const initRedis = async (): Promise<void> => {
  if (!process.env.REDIS_URL) {
    logger.info('REDIS_URL not set, using memory cache');
    return;
  }

  try {
    redisClient = createClient({ url: process.env.REDIS_URL });

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
