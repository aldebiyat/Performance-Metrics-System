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

  async createSessionWithLimit(userId: number, newTokenId: string): Promise<void> {
    const result = await query(
      'SELECT COUNT(*) FROM refresh_tokens WHERE user_id = $1 AND expires_at > NOW()',
      [userId]
    );
    const count = parseInt(result.rows[0].count, 10);

    if (count >= MAX_CONCURRENT_SESSIONS) {
      // Invalidate oldest session
      const oldest = await query(
        'SELECT id FROM refresh_tokens WHERE user_id = $1 AND expires_at > NOW() ORDER BY created_at ASC LIMIT 1',
        [userId]
      );

      if (oldest.rows[0]) {
        await query('DELETE FROM refresh_tokens WHERE id = $1', [oldest.rows[0].id]);
        logger.info(`Session limit reached for user ${userId}, invalidated oldest session`);
      }
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
