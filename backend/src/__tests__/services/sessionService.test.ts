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

  describe('enforceSessionLimit', () => {
    it('should not delete any session when under limit', async () => {
      (query as jest.Mock).mockResolvedValue({ rows: [{ count: '3' }] });

      await sessionService.enforceSessionLimit(1);

      // Should only check count, not delete anything
      expect(query).toHaveBeenCalledTimes(1);
      expect(query).not.toHaveBeenCalledWith(
        expect.stringContaining('DELETE'),
        expect.anything()
      );
    });

    it('should delete 1 session when at limit (count = 5)', async () => {
      (query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // Count check
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'oldest-token-id' }] }); // Delete

      await sessionService.enforceSessionLimit(1);

      // Should delete 1 session (5 - 5 + 1 = 1)
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM refresh_tokens'),
        [1, 1]
      );
    });

    it('should delete 3 sessions when over limit (count = 7)', async () => {
      (query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '7' }] }) // Count check
        .mockResolvedValueOnce({ rowCount: 3, rows: [{ id: '1' }, { id: '2' }, { id: '3' }] }); // Delete

      await sessionService.enforceSessionLimit(1);

      // Should delete 3 sessions (7 - 5 + 1 = 3)
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM refresh_tokens'),
        [1, 3]
      );
    });

    it('should delete oldest sessions by created_at ASC', async () => {
      (query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'oldest-token-id' }] });

      await sessionService.enforceSessionLimit(1);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at ASC'),
        expect.anything()
      );
    });

    it('should use LIMIT $2 for dynamic session removal count', async () => {
      (query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '6' }] })
        .mockResolvedValueOnce({ rowCount: 2, rows: [{ id: '1' }, { id: '2' }] });

      await sessionService.enforceSessionLimit(1);

      // Should pass sessionsToRemove (6 - 5 + 1 = 2) as second parameter
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $2'),
        [1, 2]
      );
    });

    it('should log when sessions are invalidated', async () => {
      (query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '7' }] })
        .mockResolvedValueOnce({ rowCount: 3, rows: [{ id: '1' }, { id: '2' }, { id: '3' }] });

      await sessionService.enforceSessionLimit(42);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('invalidated 3 oldest session(s)')
      );
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
