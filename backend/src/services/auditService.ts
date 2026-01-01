import { query } from '../config/database';
import logger from '../config/logger';

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

export const auditService = {
  async log(params: AuditParams): Promise<void> {
    try {
      await query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          params.userId || null,
          params.action,
          params.entityType || null,
          params.entityId || null,
          params.oldValues ? JSON.stringify(params.oldValues) : null,
          params.newValues ? JSON.stringify(params.newValues) : null,
          params.ipAddress || null,
          params.userAgent || null,
        ]
      );
    } catch (error) {
      logger.error('Failed to create audit log', { params, error });
    }
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
