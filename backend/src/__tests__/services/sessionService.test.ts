import { sessionService } from '../../services/sessionService';
import { query } from '../../config/database';
import logger from '../../config/logger';

jest.mock('../../config/database');
jest.mock('../../config/logger');

describe('sessionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('canCreateSession', () => {
    it('should allow new session when under limit', async () => {
      (query as jest.Mock).mockResolvedValue({ rows: [{ count: '3' }] });
      const result = await sessionService.canCreateSession(1);
      expect(result).toBe(true);
    });

    it('should reject new session when at limit', async () => {
      (query as jest.Mock).mockResolvedValue({ rows: [{ count: '5' }] });
      const result = await sessionService.canCreateSession(1);
      expect(result).toBe(false);
    });

    it('should reject new session when over limit', async () => {
      (query as jest.Mock).mockResolvedValue({ rows: [{ count: '7' }] });
      const result = await sessionService.canCreateSession(1);
      expect(result).toBe(false);
    });

    it('should query for non-expired sessions only', async () => {
      (query as jest.Mock).mockResolvedValue({ rows: [{ count: '0' }] });
      await sessionService.canCreateSession(123);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('expires_at > NOW()'),
        [123]
      );
    });
  });

  describe('createSessionWithLimit', () => {
    it('should not invalidate any session when under limit', async () => {
      (query as jest.Mock).mockResolvedValue({ rows: [{ count: '3' }] });

      await sessionService.createSessionWithLimit(1, 'new-token-id');

      // Should only check count, not delete anything
      expect(query).toHaveBeenCalledTimes(1);
      expect(query).not.toHaveBeenCalledWith(
        expect.stringContaining('DELETE'),
        expect.anything()
      );
    });

    it('should invalidate oldest session when at limit', async () => {
      (query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // Count check
        .mockResolvedValueOnce({ rows: [{ id: 'oldest-token-id' }] }) // Find oldest
        .mockResolvedValueOnce({ rows: [] }); // Delete oldest

      await sessionService.createSessionWithLimit(1, 'new-token-id');

      // Should delete the oldest token
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM refresh_tokens'),
        ['oldest-token-id']
      );
    });

    it('should invalidate oldest session when over limit', async () => {
      (query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '7' }] }) // Count check
        .mockResolvedValueOnce({ rows: [{ id: 'oldest-token-id' }] }) // Find oldest
        .mockResolvedValueOnce({ rows: [] }); // Delete oldest

      await sessionService.createSessionWithLimit(1, 'new-token-id');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM refresh_tokens'),
        ['oldest-token-id']
      );
    });

    it('should select oldest session by created_at ASC', async () => {
      (query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'oldest-token-id' }] })
        .mockResolvedValueOnce({ rows: [] });

      await sessionService.createSessionWithLimit(1, 'new-token-id');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at ASC LIMIT 1'),
        expect.anything()
      );
    });

    it('should handle case when no oldest session found gracefully', async () => {
      (query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: [] }); // No oldest found (edge case)

      // Should not throw
      await expect(sessionService.createSessionWithLimit(1, 'new-token-id')).resolves.not.toThrow();
    });
  });

  describe('getActiveSessions', () => {
    it('should return count of active sessions', async () => {
      (query as jest.Mock).mockResolvedValue({ rows: [{ count: '3' }] });

      const result = await sessionService.getActiveSessions(1);

      expect(result).toBe(3);
    });

    it('should return 0 when no active sessions', async () => {
      (query as jest.Mock).mockResolvedValue({ rows: [{ count: '0' }] });

      const result = await sessionService.getActiveSessions(1);

      expect(result).toBe(0);
    });

    it('should query for non-expired sessions only', async () => {
      (query as jest.Mock).mockResolvedValue({ rows: [{ count: '0' }] });
      await sessionService.getActiveSessions(456);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('expires_at > NOW()'),
        [456]
      );
    });
  });

  describe('MAX_CONCURRENT_SESSIONS configuration', () => {
    it('should use default limit of 5 when env var not set', async () => {
      // The default behavior is already tested via the other tests
      // This test verifies the default is 5 by checking the boundary
      (query as jest.Mock).mockResolvedValue({ rows: [{ count: '4' }] });
      const result = await sessionService.canCreateSession(1);
      expect(result).toBe(true);

      (query as jest.Mock).mockResolvedValue({ rows: [{ count: '5' }] });
      const result2 = await sessionService.canCreateSession(1);
      expect(result2).toBe(false);
    });
  });
});
