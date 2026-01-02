import { Router, Request, Response } from 'express';
import { adminService } from '../services/adminService';
import { auditService } from '../services/auditService';
import { asyncHandler, Errors } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/adminAuth';
import { ApiResponse } from '../types';
import { query } from '../config/database';

const router = Router();

/**
 * Verify that the admin and target user share at least one common organization.
 * This prevents cross-tenant data access via admin endpoints.
 * @param adminUserId - The ID of the admin making the request
 * @param targetUserId - The ID of the user being accessed
 * @throws Forbidden error if users don't share any organization
 */
const verifySameOrganization = async (adminUserId: number, targetUserId: number): Promise<void> => {
  // Find organizations where the admin is a member
  const adminOrgsResult = await query(
    'SELECT organization_id FROM organization_members WHERE user_id = $1',
    [adminUserId]
  );

  // Find organizations where the target user is a member
  const targetOrgsResult = await query(
    'SELECT organization_id FROM organization_members WHERE user_id = $1',
    [targetUserId]
  );

  const adminOrgIds = new Set(adminOrgsResult.rows.map(r => r.organization_id));
  const targetOrgIds = targetOrgsResult.rows.map(r => r.organization_id);

  // Check if they share at least one organization
  const hasCommonOrg = targetOrgIds.some(orgId => adminOrgIds.has(orgId));

  if (!hasCommonOrg && targetOrgIds.length > 0 && adminOrgIds.size > 0) {
    throw Errors.forbidden('Cannot access users from other organizations');
  }
};

/**
 * Check if this user is the last admin in the system
 */
const isLastAdmin = async (userId: number): Promise<boolean> => {
  // Count all active admins
  const result = await query(
    `SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_active = true AND deleted_at IS NULL`,
    []
  );
  const adminCount = parseInt(result.rows[0].count, 10);

  // Check if target user is an admin
  const userResult = await query(
    'SELECT role FROM users WHERE id = $1',
    [userId]
  );

  if (userResult.rows[0]?.role !== 'admin') {
    return false; // Not an admin, so not the last admin
  }

  return adminCount <= 1;
};

// Apply authentication and admin check to all routes
router.use(authenticate, requireAdmin);

/**
 * @swagger
 * components:
 *   schemas:
 *     AdminUser:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         email:
 *           type: string
 *           format: email
 *         name:
 *           type: string
 *           nullable: true
 *         role:
 *           type: string
 *           enum: [admin, editor, viewer]
 *         is_active:
 *           type: boolean
 *         email_verified:
 *           type: boolean
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     DashboardStats:
 *       type: object
 *       properties:
 *         totalUsers:
 *           type: integer
 *         activeUsers:
 *           type: integer
 *         totalMetrics:
 *           type: integer
 *         totalCategories:
 *           type: integer
 *         recentSignups:
 *           type: integer
 *         usersByRole:
 *           type: object
 *           properties:
 *             admin:
 *               type: integer
 *             editor:
 *               type: integer
 *             viewer:
 *               type: integer
 */

/**
 * @swagger
 * /api/admin/stats:
 *   get:
 *     summary: Get dashboard statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/DashboardStats'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await adminService.getStats();

    const response: ApiResponse<typeof stats> = {
      success: true,
      data: stats,
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: List all users with pagination
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by email or name
 *     responses:
 *       200:
 *         description: Paginated list of users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/AdminUser'
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get(
  '/users',
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 10, 100);
    const search = req.query.search as string | undefined;

    const result = await adminService.getUsers(page, limit, search, req.user!.userId);

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/AdminUser'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: User not found
 */
router.get(
  '/users/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      throw Errors.badRequest('Invalid user ID');
    }

    // Verify admin and target user share at least one organization
    await verifySameOrganization(req.user!.userId, id);

    const user = await adminService.getUserById(id);

    if (!user) {
      throw Errors.notFound('User not found');
    }

    const response: ApiResponse<typeof user> = {
      success: true,
      data: user,
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   put:
 *     summary: Update user (role, name, status)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [admin, editor, viewer]
 *               name:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/AdminUser'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: User not found
 */
router.put(
  '/users/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      throw Errors.badRequest('Invalid user ID');
    }

    // Verify admin and target user share at least one organization
    await verifySameOrganization(req.user!.userId, id);

    const { role, name, is_active } = req.body;

    // Validate role if provided
    if (role && !['admin', 'editor', 'viewer'].includes(role)) {
      throw Errors.badRequest('Invalid role. Must be admin, editor, or viewer');
    }

    // Prevent demoting last admin
    if (role && role !== 'admin') {
      if (await isLastAdmin(id)) {
        throw Errors.badRequest('Cannot change role: this is the last admin in the system');
      }
    }

    // Prevent admin from deactivating themselves
    if (id === req.user!.userId && is_active === false) {
      throw Errors.badRequest('Cannot deactivate your own account');
    }

    // Prevent admin from removing their own admin role
    if (id === req.user!.userId && role && role !== 'admin') {
      throw Errors.badRequest('Cannot remove your own admin role');
    }

    // Get old values before update for audit
    const oldUser = await adminService.getUserById(id);

    const user = await adminService.updateUser(id, { role, name, is_active });

    await auditService.log({
      userId: req.user!.userId,
      action: 'USER_UPDATED',
      entityType: 'user',
      entityId: id,
      oldValues: oldUser ? { role: oldUser.role, name: oldUser.name, is_active: oldUser.is_active } : undefined,
      newValues: { role: user.role, name: user.name, is_active: user.is_active },
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
    });

    const response: ApiResponse<typeof user> = {
      success: true,
      data: user,
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   delete:
 *     summary: Soft delete user
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: User not found
 */
router.delete(
  '/users/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      throw Errors.badRequest('Invalid user ID');
    }

    // Verify admin and target user share at least one organization
    await verifySameOrganization(req.user!.userId, id);

    // Prevent admin from deleting themselves
    if (id === req.user!.userId) {
      throw Errors.badRequest('Cannot delete your own account');
    }

    // Prevent deleting last admin
    if (await isLastAdmin(id)) {
      throw Errors.badRequest('Cannot delete: this is the last admin in the system');
    }

    // Get user info before delete for audit
    const deletedUser = await adminService.getUserById(id);

    await adminService.deleteUser(id);

    await auditService.log({
      userId: req.user!.userId,
      action: 'USER_DELETED',
      entityType: 'user',
      entityId: id,
      oldValues: deletedUser ? { email: deletedUser.email, name: deletedUser.name, role: deletedUser.role } : undefined,
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
    });

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'User deleted successfully' },
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/admin/audit-logs:
 *   get:
 *     summary: Get audit logs with pagination and filtering
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Items per page (max 100)
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *         description: Filter by user ID
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by action type
 *     responses:
 *       200:
 *         description: Paginated list of audit logs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     logs:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           user_id:
 *                             type: integer
 *                           user_email:
 *                             type: string
 *                           user_name:
 *                             type: string
 *                           action:
 *                             type: string
 *                           entity_type:
 *                             type: string
 *                           entity_id:
 *                             type: integer
 *                           old_values:
 *                             type: object
 *                           new_values:
 *                             type: object
 *                           ip_address:
 *                             type: string
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get(
  '/audit-logs',
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
    const userId = req.query.userId ? parseInt(req.query.userId as string, 10) : undefined;
    const action = req.query.action as string | undefined;

    const result = await auditService.getAuditLogs({ page, limit, userId, action });

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
    };

    res.json(response);
  })
);

export default router;
