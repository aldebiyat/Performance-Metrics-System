import { query } from '../config/database';
import logger from '../config/logger';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export const loginAttemptService = {
  async recordFailedAttempt(email: string, ipAddress: string): Promise<void> {
    try {
      await query(
        `INSERT INTO login_attempts (email, ip_address, attempted_at)
         VALUES ($1, $2, NOW())`,
        [email.toLowerCase(), ipAddress]
      );
    } catch (error) {
      // Log but don't fail login flow if tracking fails
      logger.warn('Failed to record login attempt', { email, error });
    }
  },

  async clearAttempts(email: string): Promise<void> {
    try {
      await query(
        'DELETE FROM login_attempts WHERE email = $1',
        [email.toLowerCase()]
      );
    } catch (error) {
      logger.warn('Failed to clear login attempts', { email, error });
    }
  },

  async isLocked(email: string): Promise<{ locked: boolean; remainingMinutes?: number }> {
    try {
      const result = await query(
        `SELECT COUNT(*) as attempt_count,
                MAX(attempted_at) as last_attempt
         FROM login_attempts
         WHERE email = $1
           AND attempted_at > NOW() - INTERVAL '${LOCKOUT_MINUTES} minutes'`,
        [email.toLowerCase()]
      );

      const attempts = parseInt(result.rows[0].attempt_count);

      if (attempts >= MAX_ATTEMPTS) {
        const lastAttempt = new Date(result.rows[0].last_attempt);
        const unlockTime = new Date(lastAttempt.getTime() + LOCKOUT_MINUTES * 60 * 1000);
        const remainingMs = unlockTime.getTime() - Date.now();
        const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));

        return { locked: true, remainingMinutes };
      }

      return { locked: false };
    } catch (error) {
      // If check fails, don't lock out (fail open for availability)
      logger.warn('Failed to check account lock status', { email, error });
      return { locked: false };
    }
  },

  async getAttemptCount(email: string): Promise<number> {
    try {
      const result = await query(
        `SELECT COUNT(*) as count FROM login_attempts
         WHERE email = $1 AND attempted_at > NOW() - INTERVAL '${LOCKOUT_MINUTES} minutes'`,
        [email.toLowerCase()]
      );
      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.warn('Failed to get attempt count', { email, error });
      return 0;
    }
  }
};

export default loginAttemptService;
