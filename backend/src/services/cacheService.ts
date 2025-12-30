import NodeCache from 'node-cache';

// Cache with 60 second TTL by default
const cache = new NodeCache({
  stdTTL: 60,
  checkperiod: 120,
  useClones: false,
});

export const cacheService = {
  get<T>(key: string): T | undefined {
    return cache.get<T>(key);
  },

  set<T>(key: string, value: T, ttl?: number): boolean {
    if (ttl) {
      return cache.set(key, value, ttl);
    }
    return cache.set(key, value);
  },

  del(key: string): number {
    return cache.del(key);
  },

  flush(): void {
    cache.flushAll();
  },

  // Generate cache key for metrics
  metricsKey(category: string, range: string): string {
    return `metrics:${category}:${range}`;
  },

  // Check if key exists and get cached timestamp
  getCachedAt(key: string): string | null {
    const stats = cache.getTtl(key);
    if (stats) {
      const cachedAt = new Date(stats - (cache.options.stdTTL || 60) * 1000);
      return cachedAt.toISOString();
    }
    return null;
  },

  // Wrapper for cached async functions
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl?: number
  ): Promise<{ data: T; cached: boolean; cachedAt?: string }> {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return {
        data: cached,
        cached: true,
        cachedAt: this.getCachedAt(key) || undefined,
      };
    }

    const data = await fetchFn();
    this.set(key, data, ttl);

    return {
      data,
      cached: false,
    };
  },
};

export default cacheService;
