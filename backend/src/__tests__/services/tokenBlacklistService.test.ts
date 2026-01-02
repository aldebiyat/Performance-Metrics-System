import { tokenBlacklistService } from '../../services/tokenBlacklistService';
import { getRedisClient } from '../../config/redis';

jest.mock('../../config/redis');

describe('tokenBlacklistService fail-closed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isBlacklisted', () => {
    it('should return true (blacklisted) when Redis is unavailable', async () => {
      (getRedisClient as jest.Mock).mockReturnValue(null);
      const result = await tokenBlacklistService.isBlacklisted('some-token-hash');
      expect(result).toBe(true);
    });

    it('should return false when Redis confirms token is not blacklisted', async () => {
      const mockRedis = { get: jest.fn().mockResolvedValue(null) };
      (getRedisClient as jest.Mock).mockReturnValue(mockRedis);
      const result = await tokenBlacklistService.isBlacklisted('some-token-hash');
      expect(result).toBe(false);
    });

    it('should return true when Redis confirms token is blacklisted', async () => {
      const mockRedis = { get: jest.fn().mockResolvedValue('1') };
      (getRedisClient as jest.Mock).mockReturnValue(mockRedis);
      const result = await tokenBlacklistService.isBlacklisted('some-token-hash');
      expect(result).toBe(true);
    });

    it('should return true when Redis operation throws error', async () => {
      const mockRedis = { get: jest.fn().mockRejectedValue(new Error('Connection refused')) };
      (getRedisClient as jest.Mock).mockReturnValue(mockRedis);
      const result = await tokenBlacklistService.isBlacklisted('some-token-hash');
      expect(result).toBe(true);
    });
  });

  describe('getUserTokensInvalidatedAt', () => {
    it('should return current timestamp when Redis is unavailable (fail-closed)', async () => {
      (getRedisClient as jest.Mock).mockReturnValue(null);
      const before = Date.now();
      const result = await tokenBlacklistService.getUserTokensInvalidatedAt(123);
      const after = Date.now();
      expect(result).toBeGreaterThanOrEqual(before);
      expect(result).toBeLessThanOrEqual(after);
    });

    it('should return null when user has no invalidation timestamp', async () => {
      const mockRedis = { get: jest.fn().mockResolvedValue(null) };
      (getRedisClient as jest.Mock).mockReturnValue(mockRedis);
      const result = await tokenBlacklistService.getUserTokensInvalidatedAt(123);
      expect(result).toBeNull();
    });

    it('should return stored timestamp when user has invalidation timestamp', async () => {
      const storedTimestamp = '1704067200000';
      const mockRedis = { get: jest.fn().mockResolvedValue(storedTimestamp) };
      (getRedisClient as jest.Mock).mockReturnValue(mockRedis);
      const result = await tokenBlacklistService.getUserTokensInvalidatedAt(123);
      expect(result).toBe(parseInt(storedTimestamp));
    });

    it('should return current timestamp when Redis operation throws error (fail-closed)', async () => {
      const mockRedis = { get: jest.fn().mockRejectedValue(new Error('Connection refused')) };
      (getRedisClient as jest.Mock).mockReturnValue(mockRedis);
      const before = Date.now();
      const result = await tokenBlacklistService.getUserTokensInvalidatedAt(123);
      const after = Date.now();
      expect(result).toBeGreaterThanOrEqual(before);
      expect(result).toBeLessThanOrEqual(after);
    });
  });
});
