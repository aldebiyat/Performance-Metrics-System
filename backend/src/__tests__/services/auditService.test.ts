import { auditService } from '../../services/auditService';
import { query } from '../../config/database';
import logger from '../../config/logger';

jest.mock('../../config/database');
jest.mock('../../config/logger');

describe('auditService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('should insert audit log entry with hash chain', async () => {
      const mockLastEntry = { rows: [] }; // No previous entry
      const mockInsertResult = {
        rows: [
          {
            id: 1,
            user_id: 42,
            action: 'LOGIN',
            entity_type: 'user',
            entity_id: 42,
            old_values: null,
            new_values: null,
            ip_address: '127.0.0.1',
            user_agent: 'test-agent',
            created_at: new Date('2024-01-01T00:00:00Z'),
            previous_hash: 'genesis',
          },
        ],
      };
      const mockUpdateResult = { rowCount: 1 };

      (query as jest.Mock)
        .mockResolvedValueOnce(mockLastEntry) // Get last entry hash
        .mockResolvedValueOnce(mockInsertResult) // Insert new entry
        .mockResolvedValueOnce(mockUpdateResult); // Update with entry_hash

      const result = await auditService.log({
        userId: 42,
        action: 'LOGIN',
        entityType: 'user',
        entityId: 42,
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      });

      // Should query for previous hash
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT entry_hash FROM audit_logs ORDER BY id DESC LIMIT 1')
      );

      // Should insert with previous_hash
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('previous_hash'),
        expect.arrayContaining(['genesis'])
      );

      // Should update with computed entry_hash
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE audit_logs SET entry_hash'),
        expect.arrayContaining([expect.any(String), 1])
      );

      // Should return entry with entry_hash
      expect(result).toBeDefined();
      expect(result).toHaveProperty('entry_hash');
      expect(result!.entry_hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
    });

    it('should use previous entry hash for chain linkage', async () => {
      const previousHash = 'abc123def456'.padEnd(64, '0');
      const mockLastEntry = { rows: [{ entry_hash: previousHash }] };
      const mockInsertResult = {
        rows: [
          {
            id: 2,
            user_id: 42,
            action: 'LOGOUT',
            entity_type: 'user',
            entity_id: 42,
            old_values: null,
            new_values: null,
            ip_address: '127.0.0.1',
            user_agent: 'test-agent',
            created_at: new Date('2024-01-01T00:01:00Z'),
            previous_hash: previousHash,
          },
        ],
      };
      const mockUpdateResult = { rowCount: 1 };

      (query as jest.Mock)
        .mockResolvedValueOnce(mockLastEntry)
        .mockResolvedValueOnce(mockInsertResult)
        .mockResolvedValueOnce(mockUpdateResult);

      await auditService.log({
        userId: 42,
        action: 'LOGOUT',
        entityType: 'user',
        entityId: 42,
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      });

      // Should insert with previous entry's hash
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([previousHash])
      );
    });

    it('should handle errors gracefully', async () => {
      (query as jest.Mock).mockRejectedValue(new Error('Database error'));

      await auditService.log({
        action: 'LOGIN',
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to create audit log',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe('verifyIntegrity', () => {
    it('should return valid: true for empty audit log', async () => {
      (query as jest.Mock).mockResolvedValue({ rows: [] });

      const result = await auditService.verifyIntegrity();

      expect(result).toEqual({
        valid: true,
        entriesChecked: 0,
        errors: [],
      });
    });

    it('should return valid: true for intact hash chain', async () => {
      const entry1 = {
        id: 1,
        user_id: 1,
        action: 'LOGIN',
        entity_type: 'user',
        entity_id: 1,
        old_values: null,
        new_values: null,
        created_at: new Date('2024-01-01T00:00:00Z'),
        previous_hash: 'genesis',
        entry_hash: '', // Will be computed
      };

      // Compute correct hash for entry1
      const crypto = require('crypto');
      const data1 = JSON.stringify({
        id: entry1.id,
        user_id: entry1.user_id,
        action: entry1.action,
        entity_type: entry1.entity_type,
        entity_id: entry1.entity_id,
        old_values: entry1.old_values,
        new_values: entry1.new_values,
        created_at: entry1.created_at,
        previous_hash: entry1.previous_hash,
      });
      entry1.entry_hash = crypto.createHash('sha256').update(data1).digest('hex');

      const entry2 = {
        id: 2,
        user_id: 1,
        action: 'LOGOUT',
        entity_type: 'user',
        entity_id: 1,
        old_values: null,
        new_values: null,
        created_at: new Date('2024-01-01T00:01:00Z'),
        previous_hash: entry1.entry_hash,
        entry_hash: '',
      };

      const data2 = JSON.stringify({
        id: entry2.id,
        user_id: entry2.user_id,
        action: entry2.action,
        entity_type: entry2.entity_type,
        entity_id: entry2.entity_id,
        old_values: entry2.old_values,
        new_values: entry2.new_values,
        created_at: entry2.created_at,
        previous_hash: entry2.previous_hash,
      });
      entry2.entry_hash = crypto.createHash('sha256').update(data2).digest('hex');

      (query as jest.Mock).mockResolvedValue({ rows: [entry1, entry2] });

      const result = await auditService.verifyIntegrity();

      expect(result).toEqual({
        valid: true,
        entriesChecked: 2,
        errors: [],
      });
    });

    it('should detect previous_hash mismatch', async () => {
      const entry1 = {
        id: 1,
        user_id: 1,
        action: 'LOGIN',
        entity_type: 'user',
        entity_id: 1,
        old_values: null,
        new_values: null,
        created_at: new Date('2024-01-01T00:00:00Z'),
        previous_hash: 'genesis',
        entry_hash: 'hash1'.padEnd(64, '0'),
      };

      const entry2 = {
        id: 2,
        user_id: 1,
        action: 'LOGOUT',
        entity_type: 'user',
        entity_id: 1,
        old_values: null,
        new_values: null,
        created_at: new Date('2024-01-01T00:01:00Z'),
        previous_hash: 'wrong_hash'.padEnd(64, '0'), // Should be entry1.entry_hash
        entry_hash: 'hash2'.padEnd(64, '0'),
      };

      (query as jest.Mock).mockResolvedValue({ rows: [entry1, entry2] });

      const result = await auditService.verifyIntegrity();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Entry 2: previous_hash mismatch');
    });

    it('should detect entry_hash tampering', async () => {
      const entry1 = {
        id: 1,
        user_id: 1,
        action: 'LOGIN',
        entity_type: 'user',
        entity_id: 1,
        old_values: null,
        new_values: null,
        created_at: new Date('2024-01-01T00:00:00Z'),
        previous_hash: 'genesis',
        entry_hash: 'tampered_hash'.padEnd(64, '0'), // Wrong hash
      };

      (query as jest.Mock).mockResolvedValue({ rows: [entry1] });

      const result = await auditService.verifyIntegrity();

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('Entry 1: entry_hash mismatch (tampering detected)')
      );
    });

    it('should query entries in ascending order by id', async () => {
      (query as jest.Mock).mockResolvedValue({ rows: [] });

      await auditService.verifyIntegrity();

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY id ASC')
      );
    });
  });

  describe('getAuditLogs', () => {
    it('should return paginated audit logs', async () => {
      const mockLogs = [
        { id: 1, action: 'LOGIN', user_email: 'test@example.com' },
      ];
      (query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: mockLogs });

      const result = await auditService.getAuditLogs({ page: 1, limit: 50 });

      expect(result).toEqual({
        logs: mockLogs,
        total: 1,
        page: 1,
        limit: 50,
      });
    });

    it('should filter by userId when provided', async () => {
      (query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [] });

      await auditService.getAuditLogs({ userId: 42 });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE al.user_id'),
        expect.arrayContaining([42])
      );
    });

    it('should filter by action when provided', async () => {
      (query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [] });

      await auditService.getAuditLogs({ action: 'LOGIN' });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE al.action'),
        expect.arrayContaining(['LOGIN'])
      );
    });
  });
});
