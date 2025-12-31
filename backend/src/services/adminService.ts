import { query } from '../config/database';
import { User } from '../types';
import { Errors } from '../middleware/errorHandler';

export interface PaginatedUsers {
  users: Omit<User, 'password_hash'>[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalMetrics: number;
  totalCategories: number;
  recentSignups: number;
  usersByRole: {
    admin: number;
    editor: number;
    viewer: number;
  };
}

export const adminService = {
  async getUsers(page: number = 1, limit: number = 10, search?: string): Promise<PaginatedUsers> {
    const offset = (page - 1) * limit;

    let countQuery = 'SELECT COUNT(*) FROM users WHERE deleted_at IS NULL';
    let usersQuery = `
      SELECT id, email, name, role, is_active, email_verified, created_at, updated_at
      FROM users
      WHERE deleted_at IS NULL
    `;
    const params: (string | number)[] = [];

    if (search) {
      countQuery += ' AND (email ILIKE $1 OR name ILIKE $1)';
      usersQuery += ' AND (email ILIKE $1 OR name ILIKE $1)';
      params.push(`%${search}%`);
    }

    usersQuery += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const [countResult, usersResult] = await Promise.all([
      query(countQuery, search ? [`%${search}%`] : []),
      query(usersQuery, params),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);

    return {
      users: usersResult.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  async getUserById(id: number): Promise<Omit<User, 'password_hash'> | null> {
    const result = await query(
      `SELECT id, email, name, role, is_active, email_verified, created_at, updated_at
       FROM users
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    return result.rows[0] || null;
  },

  async updateUser(
    id: number,
    data: { role?: 'admin' | 'editor' | 'viewer'; name?: string; is_active?: boolean }
  ): Promise<Omit<User, 'password_hash'>> {
    // Check if user exists
    const existingUser = await this.getUserById(id);
    if (!existingUser) {
      throw Errors.notFound('User not found');
    }

    const updates: string[] = [];
    const values: (string | boolean | number)[] = [];
    let paramCount = 1;

    if (data.role !== undefined) {
      updates.push(`role = $${paramCount++}`);
      values.push(data.role);
    }

    if (data.name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(data.name);
    }

    if (data.is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(data.is_active);
    }

    if (updates.length === 0) {
      return existingUser;
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
      `UPDATE users
       SET ${updates.join(', ')}
       WHERE id = $${paramCount} AND deleted_at IS NULL
       RETURNING id, email, name, role, is_active, email_verified, created_at, updated_at`,
      values
    );

    return result.rows[0];
  },

  async deleteUser(id: number): Promise<void> {
    const existingUser = await this.getUserById(id);
    if (!existingUser) {
      throw Errors.notFound('User not found');
    }

    // Soft delete: set deleted_at timestamp
    await query(
      `UPDATE users
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    // Also invalidate all refresh tokens for this user
    await query('DELETE FROM refresh_tokens WHERE user_id = $1', [id]);
  },

  async getStats(): Promise<DashboardStats> {
    const [
      usersResult,
      activeUsersResult,
      metricsResult,
      categoriesResult,
      recentSignupsResult,
      roleStatsResult,
    ] = await Promise.all([
      query('SELECT COUNT(*) FROM users WHERE deleted_at IS NULL'),
      query('SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND is_active = true'),
      query('SELECT COUNT(*) FROM metric_definitions WHERE is_active = true'),
      query('SELECT COUNT(*) FROM categories'),
      query(
        `SELECT COUNT(*) FROM users
         WHERE deleted_at IS NULL AND created_at > NOW() - INTERVAL '7 days'`
      ),
      query(
        `SELECT role, COUNT(*) as count
         FROM users
         WHERE deleted_at IS NULL
         GROUP BY role`
      ),
    ]);

    const usersByRole = { admin: 0, editor: 0, viewer: 0 };
    roleStatsResult.rows.forEach((row: { role: 'admin' | 'editor' | 'viewer'; count: string }) => {
      usersByRole[row.role] = parseInt(row.count, 10);
    });

    return {
      totalUsers: parseInt(usersResult.rows[0].count, 10),
      activeUsers: parseInt(activeUsersResult.rows[0].count, 10),
      totalMetrics: parseInt(metricsResult.rows[0].count, 10),
      totalCategories: parseInt(categoriesResult.rows[0].count, 10),
      recentSignups: parseInt(recentSignupsResult.rows[0].count, 10),
      usersByRole,
    };
  },
};

export default adminService;
