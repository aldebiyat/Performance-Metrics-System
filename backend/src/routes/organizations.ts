import { Router, Request, Response } from 'express';
import { organizationService } from '../services/organizationService';
import { asyncHandler, Errors } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { ApiResponse } from '../types';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/organizations:
 *   post:
 *     summary: Create a new organization
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 description: Organization name
 *     responses:
 *       201:
 *         description: Organization created successfully
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw Errors.validation('Organization name is required');
    }

    const organization = await organizationService.createOrganization(name.trim(), req.user!.userId);

    const response: ApiResponse<typeof organization> = {
      success: true,
      data: organization,
    };

    res.status(201).json(response);
  })
);

/**
 * @swagger
 * /api/organizations:
 *   get:
 *     summary: List user's organizations
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of organizations
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const organizations = await organizationService.getUserOrganizations(req.user!.userId);
    const currentOrg = await organizationService.getCurrentOrganization(req.user!.userId);

    const response: ApiResponse<{ organizations: typeof organizations; currentOrganization: typeof currentOrg }> = {
      success: true,
      data: {
        organizations,
        currentOrganization: currentOrg,
      },
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/organizations/{id}:
 *   get:
 *     summary: Get organization details
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Organization details
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a member of this organization
 *       404:
 *         description: Organization not found
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = parseInt(req.params.id, 10);

    if (isNaN(orgId)) {
      throw Errors.validation('Invalid organization ID');
    }

    // Check membership
    const isMember = await organizationService.isMember(orgId, req.user!.userId);
    if (!isMember) {
      throw Errors.forbidden('You are not a member of this organization');
    }

    const organization = await organizationService.getOrganization(orgId);
    if (!organization) {
      throw Errors.notFound('Organization not found');
    }

    const members = await organizationService.getOrganizationMembers(orgId);

    const response: ApiResponse<{ organization: typeof organization; members: typeof members }> = {
      success: true,
      data: {
        organization,
        members,
      },
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/organizations/{id}:
 *   put:
 *     summary: Update organization details
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               settings:
 *                 type: object
 *     responses:
 *       200:
 *         description: Organization updated
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not an admin of this organization
 *       404:
 *         description: Organization not found
 */
router.put(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = parseInt(req.params.id, 10);

    if (isNaN(orgId)) {
      throw Errors.validation('Invalid organization ID');
    }

    // Check admin permission
    const isAdmin = await organizationService.isOrgAdmin(orgId, req.user!.userId);
    if (!isAdmin) {
      throw Errors.forbidden('Only organization admins can update settings');
    }

    const { name, settings } = req.body;
    const updates: { name?: string; settings?: Record<string, unknown> } = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        throw Errors.validation('Organization name cannot be empty');
      }
      updates.name = name.trim();
    }

    if (settings !== undefined) {
      if (typeof settings !== 'object' || settings === null) {
        throw Errors.validation('Settings must be an object');
      }
      updates.settings = settings;
    }

    const organization = await organizationService.updateOrganization(orgId, updates);

    if (!organization) {
      throw Errors.notFound('Organization not found');
    }

    const response: ApiResponse<typeof organization> = {
      success: true,
      data: organization,
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/organizations/{id}:
 *   delete:
 *     summary: Delete an organization
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Organization deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only owner can delete
 *       404:
 *         description: Organization not found
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = parseInt(req.params.id, 10);

    if (isNaN(orgId)) {
      throw Errors.validation('Invalid organization ID');
    }

    await organizationService.deleteOrganization(orgId, req.user!.userId);

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Organization deleted successfully' },
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/organizations/{id}/members:
 *   post:
 *     summary: Add a member to organization
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId]
 *             properties:
 *               userId:
 *                 type: integer
 *               role:
 *                 type: string
 *                 enum: [admin, member, viewer]
 *     responses:
 *       201:
 *         description: Member added
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not an admin
 *       404:
 *         description: Organization or user not found
 *       409:
 *         description: User already a member
 */
router.post(
  '/:id/members',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = parseInt(req.params.id, 10);

    if (isNaN(orgId)) {
      throw Errors.validation('Invalid organization ID');
    }

    // Check admin permission
    const isAdmin = await organizationService.isOrgAdmin(orgId, req.user!.userId);
    if (!isAdmin) {
      throw Errors.forbidden('Only organization admins can add members');
    }

    const { userId, role = 'member' } = req.body;

    if (!userId || typeof userId !== 'number') {
      throw Errors.validation('User ID is required');
    }

    const member = await organizationService.addMember(orgId, userId, role);

    const response: ApiResponse<typeof member> = {
      success: true,
      data: member,
    };

    res.status(201).json(response);
  })
);

/**
 * @swagger
 * /api/organizations/{id}/members/{userId}:
 *   delete:
 *     summary: Remove a member from organization
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Member removed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not an admin or trying to remove owner
 *       404:
 *         description: Member not found
 */
router.delete(
  '/:id/members/:userId',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = parseInt(req.params.id, 10);
    const userId = parseInt(req.params.userId, 10);

    if (isNaN(orgId) || isNaN(userId)) {
      throw Errors.validation('Invalid organization or user ID');
    }

    // Check admin permission (or user removing themselves)
    const isAdmin = await organizationService.isOrgAdmin(orgId, req.user!.userId);
    const isSelf = req.user!.userId === userId;

    if (!isAdmin && !isSelf) {
      throw Errors.forbidden('Only organization admins can remove members');
    }

    await organizationService.removeMember(orgId, userId);

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Member removed successfully' },
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/organizations/{id}/members/{userId}:
 *   put:
 *     summary: Update member role
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [admin, member, viewer]
 *     responses:
 *       200:
 *         description: Member role updated
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not an admin
 *       404:
 *         description: Member not found
 */
router.put(
  '/:id/members/:userId',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = parseInt(req.params.id, 10);
    const userId = parseInt(req.params.userId, 10);

    if (isNaN(orgId) || isNaN(userId)) {
      throw Errors.validation('Invalid organization or user ID');
    }

    // Check admin permission
    const isAdmin = await organizationService.isOrgAdmin(orgId, req.user!.userId);
    if (!isAdmin) {
      throw Errors.forbidden('Only organization admins can change member roles');
    }

    const { role } = req.body;

    if (!role || typeof role !== 'string') {
      throw Errors.validation('Role is required');
    }

    const member = await organizationService.updateMemberRole(orgId, userId, role);

    const response: ApiResponse<typeof member> = {
      success: true,
      data: member,
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/organizations/{id}/switch:
 *   post:
 *     summary: Switch to this organization
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Switched to organization
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a member of this organization
 */
router.post(
  '/:id/switch',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = parseInt(req.params.id, 10);

    if (isNaN(orgId)) {
      throw Errors.validation('Invalid organization ID');
    }

    await organizationService.switchOrganization(req.user!.userId, orgId);

    const currentOrg = await organizationService.getCurrentOrganization(req.user!.userId);

    const response: ApiResponse<{ message: string; currentOrganization: typeof currentOrg }> = {
      success: true,
      data: {
        message: 'Switched organization successfully',
        currentOrganization: currentOrg,
      },
    };

    res.json(response);
  })
);

export default router;
