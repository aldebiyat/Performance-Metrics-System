import { query } from '../config/database';
import logger from '../config/logger';

const MAX_CONCURRENT_SESSIONS = parseInt(process.env.MAX_CONCURRENT_SESSIONS || '5', 10);

export const sessionService = {
  async canCreateSession(userId: number): Promise<boolean> {
    const result = await query(
      'SELECT COUNT(*) FROM refresh_tokens WHERE user_id = $1 AND expires_at > NOW()',
      [userId]
    );
    const count = parseInt(result.rows[0].count, 10);
    return count < MAX_CONCURRENT_SESSIONS;
  },

  /**
   * Enforces session limit by removing oldest sessions if at/over limit.
   * Should be called BEFORE creating a new session.
   */
  async enforceSessionLimit(userId: number): Promise<void> {
    const result = await query(
      'SELECT COUNT(*) FROM refresh_tokens WHERE user_id = $1 AND expires_at > NOW()',
      [userId]
    );
    const count = parseInt(result.rows[0].count, 10);

    // Need to delete enough sessions to make room for the new one
    // If count >= MAX, we need to delete (count - MAX + 1) sessions
    if (count >= MAX_CONCURRENT_SESSIONS) {
      const sessionsToRemove = count - MAX_CONCURRENT_SESSIONS + 1;

      const deleted = await query(
        `DELETE FROM refresh_tokens
         WHERE id IN (
           SELECT id FROM refresh_tokens
           WHERE user_id = $1 AND expires_at > NOW()
           ORDER BY created_at ASC
           LIMIT $2
         )
         RETURNING id`,
        [userId, sessionsToRemove]
      );

      logger.info(`Session limit reached for user ${userId}, invalidated ${deleted.rowCount} oldest session(s)`);
    }
  },

  async getActiveSessions(userId: number): Promise<number> {
    const result = await query(
      'SELECT COUNT(*) FROM refresh_tokens WHERE user_id = $1 AND expires_at > NOW()',
      [userId]
    );
    return parseInt(result.rows[0].count, 10);
  },
};
