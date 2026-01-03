import crypto from 'crypto';
import { query, getPool } from '../config/database';
import logger from '../config/logger';

let auditFailureCount = 0;
const AUDIT_FAILURE_THRESHOLD = 5;
const GENESIS_HASH = 'genesis';

interface AuditParams {
  userId?: number;
  action: string;
  entityType?: string;
  entityId?: number;
  oldValues?: object;
  newValues?: object;
  ipAddress?: string;
  userAgent?: string;
}

interface AuditLogEntry {
  id: number;
  user_id: number | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  old_values: object | null;
  new_values: object | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
  previous_hash: string;
  entry_hash: string;
}

interface IntegrityResult {
  valid: boolean;
  entriesChecked: number;
  errors: string[];
}

const computeEntryHash = (entry: AuditLogEntry): string => {
  const data = JSON.stringify({
    id: entry.id,
    user_id: entry.user_id,
    action: entry.action,
    entity_type: entry.entity_type,
    entity_id: entry.entity_id,
    old_values: entry.old_values,
    new_values: entry.new_values,
    created_at: entry.created_at,
    previous_hash: entry.previous_hash,
  });
  return crypto.createHash('sha256').update(data).digest('hex');
};

export const auditService = {
  async log(params: AuditParams): Promise<AuditLogEntry | undefined> {
    const client = await getPool().connect();

    try {
      await client.query('BEGIN');

      // Use advisory lock to serialize audit log inserts
      await client.query('SELECT pg_advisory_xact_lock($1)', [1234567890]);

      // Get hash of previous entry
      const lastEntry = await client.query(
        'SELECT entry_hash FROM audit_logs ORDER BY id DESC LIMIT 1'
      );
      const previousHash = lastEntry.rows[0]?.entry_hash || GENESIS_HASH;

      // Insert new entry
      const result = await client.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent, previous_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          params.userId || null,
          params.action,
          params.entityType || null,
          params.entityId || null,
          params.oldValues ? JSON.stringify(params.oldValues) : null,
          params.newValues ? JSON.stringify(params.newValues) : null,
          params.ipAddress || null,
          params.userAgent || null,
          previousHash,
        ]
      );

      const entry = result.rows[0] as AuditLogEntry;

      // Compute and store hash
      const entryHash = computeEntryHash(entry);
      await client.query(
        'UPDATE audit_logs SET entry_hash = $1 WHERE id = $2',
        [entryHash, entry.id]
      );

      await client.query('COMMIT');

      auditFailureCount = 0;
      return { ...entry, entry_hash: entryHash };
    } catch (error) {
      await client.query('ROLLBACK');
      auditFailureCount++;
      logger.error('Failed to create audit log', { params, error, failureCount: auditFailureCount });
      if (auditFailureCount >= AUDIT_FAILURE_THRESHOLD) {
        logger.error('CRITICAL: Audit logging system failure threshold exceeded', {
          consecutiveFailures: auditFailureCount,
          threshold: AUDIT_FAILURE_THRESHOLD,
        });
      }
      return undefined;
    } finally {
      client.release();
    }
  },

  async verifyIntegrity(batchSize = 10000): Promise<IntegrityResult> {
    const errors: string[] = [];
    let previousHash = GENESIS_HASH;
    let offset = 0;
    let totalChecked = 0;

    while (true) {
      const batch = await query(
        'SELECT * FROM audit_logs ORDER BY id ASC LIMIT $1 OFFSET $2',
        [batchSize, offset]
      );

      if (batch.rows.length === 0) break;

      for (const entry of batch.rows as AuditLogEntry[]) {
        if (entry.previous_hash !== previousHash) {
          errors.push(`Entry ${entry.id}: previous_hash mismatch`);
        }
        const computed = computeEntryHash(entry);
        if (entry.entry_hash !== computed) {
          errors.push(`Entry ${entry.id}: entry_hash mismatch (tampering detected)`);
        }
        previousHash = entry.entry_hash;
        totalChecked++;
      }

      offset += batchSize;
    }

    return {
      valid: errors.length === 0,
      entriesChecked: totalChecked,
      errors,
    };
  },

  async getAuditLogs(options: { page?: number; limit?: number; userId?: number; action?: string }) {
    const { page = 1, limit = 50, userId, action } = options;
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params: (string | number | null)[] = [];

    if (userId) {
      params.push(userId);
      whereClause += ` WHERE al.user_id = $${params.length}`;
    }

    if (action) {
      params.push(action);
      whereClause += whereClause ? ` AND al.action = $${params.length}` : ` WHERE al.action = $${params.length}`;
    }

    const countResult = await query(`SELECT COUNT(*) FROM audit_logs al${whereClause}`, params);

    params.push(limit, offset);
    const result = await query(
      `SELECT al.*, u.email as user_email, u.name as user_name
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return {
      logs: result.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit,
    };
  },
};
