import { tokenBlacklistService } from '../../services/tokenBlacklistService';
import { getRedisClient } from '../../config/redis';

jest.mock('../../config/redis');

describe('tokenBlacklistService fail-closed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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
