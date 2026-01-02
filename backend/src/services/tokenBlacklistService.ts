import { getRedisClient } from '../config/redis';
import logger from '../config/logger';

const BLACKLIST_PREFIX = 'token_blacklist:';
const USER_INVALIDATED_PREFIX = 'user_tokens_invalid:';

export const tokenBlacklistService = {
  /**
   * Add a token to the blacklist
   * @param tokenId - JWT ID (jti) or token hash
   * @param expiresInSeconds - TTL for the blacklist entry (should match token expiry)
   */
  async blacklist(tokenId: string, expiresInSeconds: number): Promise<void> {
    const redis = getRedisClient();
    if (!redis) {
      logger.warn('Redis not available, token revocation not persisted');
      return;
    }

    try {
      await redis.setEx(`${BLACKLIST_PREFIX}${tokenId}`, expiresInSeconds, '1');
    } catch (error) {
      logger.error('Failed to blacklist token', { error });
    }
  },

  /**
   * Check if a token is blacklisted
   * SECURITY: Fails closed - if we cannot verify, treat as blacklisted
   */
  async isBlacklisted(tokenId: string): Promise<boolean> {
    const redis = getRedisClient();

    if (!redis) {
      // FAIL-CLOSED: Cannot verify, treat as blacklisted
      logger.warn('Token blacklist check failed: Redis unavailable - treating as blacklisted');
      return true;
    }

    try {
      const key = `${BLACKLIST_PREFIX}${tokenId}`;
      const result = await redis.get(key);
      return result !== null;
    } catch (error) {
      // FAIL-CLOSED: Error checking, treat as blacklisted
      logger.error('Token blacklist check failed:', error);
      return true;
    }
  },

  /**
   * Invalidate all tokens for a user (on password change, logout all, etc.)
   * Store the invalidation timestamp
   */
  async invalidateUserTokens(userId: number): Promise<void> {
    const redis = getRedisClient();
    if (!redis) return;

    try {
      // Store timestamp, keep for 7 days (max refresh token lifetime)
      await redis.setEx(`${USER_INVALIDATED_PREFIX}${userId}`, 7 * 24 * 60 * 60, Date.now().toString());
    } catch (error) {
      logger.error('Failed to invalidate user tokens', { error });
    }
  },

  async getUserTokensInvalidatedAt(userId: number): Promise<number | null> {
    const redis = getRedisClient();
    if (!redis) return null;

    try {
      const timestamp = await redis.get(`${USER_INVALIDATED_PREFIX}${userId}`);
      return timestamp ? parseInt(timestamp) : null;
    } catch (error) {
      logger.error('Failed to get user token invalidation time', { error });
      return null;
    }
  }
};

export default tokenBlacklistService;
