import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { Errors } from './errorHandler';

/**
 * Middleware to require and validate organization membership.
 * Gets the user's current_organization_id, verifies membership,
 * and sets req.organizationId and req.organizationRole.
 */
export const requireOrganization = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  // Check if user is authenticated
  if (!req.user) {
    throw Errors.unauthorized('Not authenticated');
  }

  // Get user's current organization
  const userResult = await query(
    'SELECT id, current_organization_id FROM users WHERE id = $1',
    [req.user.userId]
  );

  if (userResult.rows.length === 0) {
    throw Errors.unauthorized('User not found');
  }

  const user = userResult.rows[0];

  if (!user.current_organization_id) {
    throw Errors.forbidden('No organization selected');
  }

  // Verify user is a member of the organization
  const membershipResult = await query(
    'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
    [user.current_organization_id, req.user.userId]
  );

  if (membershipResult.rows.length === 0) {
    throw Errors.forbidden('Not a member of this organization');
  }

  // Set organization context on request
  req.organizationId = user.current_organization_id;
  req.organizationRole = membershipResult.rows[0].role;

  next();
};

/**
 * Middleware to validate that the orgId parameter matches the user's current organization.
 * Must be used after requireOrganization.
 */
export const validateOrganizationAccess = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (!req.organizationId) {
    throw Errors.forbidden('Organization context not established');
  }

  const orgIdParam = parseInt(req.params.orgId, 10);

  if (orgIdParam !== req.organizationId) {
    throw Errors.forbidden('Access denied to this organization');
  }

  next();
};

/**
 * Middleware to require organization admin role.
 * Must be used after requireOrganization.
 */
export const requireOrgAdmin = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (req.organizationRole !== 'admin') {
    throw Errors.forbidden('Organization admin access required');
  }

  next();
};
