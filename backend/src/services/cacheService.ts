import NodeCache from 'node-cache';
import { getRedisClient } from '../config/redis';
import logger from '../config/logger';

// Fallback memory cache
const memoryCache = new NodeCache({ stdTTL: 300 });

export const cacheService = {
  async get<T>(key: string): Promise<T | null> {
    const redis = getRedisClient();

    if (redis) {
      try {
        const value = await redis.get(key);
        return value ? JSON.parse(value) : null;
      } catch (error) {
        logger.error('Redis get error', { key, error });
        // Fallback to memory
      }
    }

    return memoryCache.get<T>(key) || null;
  },

  async set<T>(key: string, value: T, ttlSeconds: number = 300): Promise<void> {
    const redis = getRedisClient();

    if (redis) {
      try {
        await redis.setEx(key, ttlSeconds, JSON.stringify(value));
        return;
      } catch (error) {
        logger.error('Redis set error', { key, error });
        // Fallback to memory
      }
    }

    memoryCache.set(key, value, ttlSeconds);
  },

  async del(key: string): Promise<void> {
    const redis = getRedisClient();

    if (redis) {
      try {
        await redis.del(key);
      } catch (error) {
        logger.error('Redis del error', { key, error });
      }
    }

    memoryCache.del(key);
  },

  async flush(): Promise<void> {
    const redis = getRedisClient();

    if (redis) {
      try {
        await redis.flushDb();
      } catch (error) {
        logger.error('Redis flush error', { error });
      }
    }

    memoryCache.flushAll();
  },

  // Generate cache key for metrics
  metricsKey(category: string, range: string): string {
    return `metrics:${category}:${range}`;
  },

  // Wrapper for cached async functions
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = 300
  ): Promise<{ data: T; cached: boolean }> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return {
        data: cached,
        cached: true,
      };
    }

    const data = await fetchFn();
    await this.set(key, data, ttl);

    return {
      data,
      cached: false,
    };
  },
};

export default cacheService;
