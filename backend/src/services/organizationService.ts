import { query } from '../config/database';
import { Errors } from '../middleware/errorHandler';

export interface Organization {
  id: number;
  name: string;
  slug: string;
  owner_id: number | null;
  settings: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface OrganizationMember {
  id: number;
  organization_id: number;
  user_id: number;
  role: string;
  created_at: Date;
}

export interface OrganizationWithRole extends Organization {
  user_role: string;
}

export interface MemberWithUser extends OrganizationMember {
  email: string;
  name: string | null;
}

/**
 * Generate a URL-friendly slug from a name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

/**
 * Ensure slug is unique by appending a number if necessary
 */
async function ensureUniqueSlug(baseSlug: string, excludeId?: number): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await query(
      'SELECT id FROM organizations WHERE slug = $1' + (excludeId ? ' AND id != $2' : ''),
      excludeId ? [slug, excludeId] : [slug]
    );

    if (existing.rows.length === 0) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

export const organizationService = {
  /**
   * Create a new organization and add the owner as an admin member
   */
  async createOrganization(name: string, ownerId: number): Promise<Organization> {
    const baseSlug = generateSlug(name);
    const slug = await ensureUniqueSlug(baseSlug);

    // Start a transaction to create org and add owner as member
    const orgResult = await query(
      `INSERT INTO organizations (name, slug, owner_id)
       VALUES ($1, $2, $3)
       RETURNING id, name, slug, owner_id, settings, created_at, updated_at`,
      [name, slug, ownerId]
    );

    const organization = orgResult.rows[0];

    // Add owner as admin member
    await query(
      `INSERT INTO organization_members (organization_id, user_id, role)
       VALUES ($1, $2, 'admin')`,
      [organization.id, ownerId]
    );

    // Set as user's current organization if they don't have one
    await query(
      `UPDATE users SET current_organization_id = $1
       WHERE id = $2 AND current_organization_id IS NULL`,
      [organization.id, ownerId]
    );

    return organization;
  },

  /**
   * Get organization by ID
   */
  async getOrganization(id: number): Promise<Organization | null> {
    const result = await query(
      `SELECT id, name, slug, owner_id, settings, created_at, updated_at
       FROM organizations
       WHERE id = $1`,
      [id]
    );

    return result.rows[0] || null;
  },

  /**
   * Get organization by slug
   */
  async getOrganizationBySlug(slug: string): Promise<Organization | null> {
    const result = await query(
      `SELECT id, name, slug, owner_id, settings, created_at, updated_at
       FROM organizations
       WHERE slug = $1`,
      [slug]
    );

    return result.rows[0] || null;
  },

  /**
   * Get all organizations for a user
   */
  async getUserOrganizations(userId: number): Promise<OrganizationWithRole[]> {
    const result = await query(
      `SELECT o.id, o.name, o.slug, o.owner_id, o.settings, o.created_at, o.updated_at,
              om.role as user_role
       FROM organizations o
       JOIN organization_members om ON o.id = om.organization_id
       WHERE om.user_id = $1
       ORDER BY o.name`,
      [userId]
    );

    return result.rows;
  },

  /**
   * Update organization details
   */
  async updateOrganization(
    id: number,
    updates: { name?: string; settings?: Record<string, unknown> }
  ): Promise<Organization | null> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      const baseSlug = generateSlug(updates.name);
      const slug = await ensureUniqueSlug(baseSlug, id);
      setClauses.push(`name = $${paramIndex++}`);
      values.push(updates.name);
      setClauses.push(`slug = $${paramIndex++}`);
      values.push(slug);
    }

    if (updates.settings !== undefined) {
      setClauses.push(`settings = $${paramIndex++}`);
      values.push(JSON.stringify(updates.settings));
    }

    if (setClauses.length === 0) {
      return this.getOrganization(id);
    }

    values.push(id);
    const result = await query(
      `UPDATE organizations
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, name, slug, owner_id, settings, created_at, updated_at`,
      values
    );

    return result.rows[0] || null;
  },

  /**
   * Add a member to an organization
   */
  async addMember(orgId: number, userId: number, role: string = 'member'): Promise<OrganizationMember> {
    // Check if user exists
    const userCheck = await query(
      'SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      throw Errors.notFound('User not found');
    }

    // Check if organization exists
    const orgCheck = await query(
      'SELECT id FROM organizations WHERE id = $1',
      [orgId]
    );

    if (orgCheck.rows.length === 0) {
      throw Errors.notFound('Organization not found');
    }

    // Check if already a member
    const existingMember = await query(
      'SELECT id FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [orgId, userId]
    );

    if (existingMember.rows.length > 0) {
      throw Errors.conflict('User is already a member of this organization');
    }

    const result = await query(
      `INSERT INTO organization_members (organization_id, user_id, role)
       VALUES ($1, $2, $3)
       RETURNING id, organization_id, user_id, role, created_at`,
      [orgId, userId, role]
    );

    return result.rows[0];
  },

  /**
   * Remove a member from an organization
   */
  async removeMember(orgId: number, userId: number): Promise<void> {
    // Check if user is the owner
    const org = await this.getOrganization(orgId);
    if (org && org.owner_id === userId) {
      throw Errors.badRequest('Cannot remove the organization owner. Transfer ownership first.');
    }

    const result = await query(
      'DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2 RETURNING id',
      [orgId, userId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Member not found in organization');
    }

    // If this was user's current organization, clear it
    await query(
      'UPDATE users SET current_organization_id = NULL WHERE id = $1 AND current_organization_id = $2',
      [userId, orgId]
    );
  },

  /**
   * Update a member's role in an organization
   */
  async updateMemberRole(orgId: number, userId: number, role: string): Promise<OrganizationMember | null> {
    const validRoles = ['admin', 'member', 'viewer'];
    if (!validRoles.includes(role)) {
      throw Errors.validation(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    const result = await query(
      `UPDATE organization_members
       SET role = $1
       WHERE organization_id = $2 AND user_id = $3
       RETURNING id, organization_id, user_id, role, created_at`,
      [role, orgId, userId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Member not found in organization');
    }

    return result.rows[0];
  },

  /**
   * Switch user's current organization
   */
  async switchOrganization(userId: number, orgId: number): Promise<void> {
    // Verify user is a member of the organization
    const membership = await query(
      'SELECT id FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [orgId, userId]
    );

    if (membership.rows.length === 0) {
      throw Errors.forbidden('You are not a member of this organization');
    }

    await query(
      'UPDATE users SET current_organization_id = $1 WHERE id = $2',
      [orgId, userId]
    );
  },

  /**
   * Get all members of an organization
   */
  async getOrganizationMembers(orgId: number): Promise<MemberWithUser[]> {
    const result = await query(
      `SELECT om.id, om.organization_id, om.user_id, om.role, om.created_at,
              u.email, u.name
       FROM organization_members om
       JOIN users u ON om.user_id = u.id
       WHERE om.organization_id = $1 AND u.deleted_at IS NULL
       ORDER BY om.role, u.name, u.email`,
      [orgId]
    );

    return result.rows;
  },

  /**
   * Check if user is an admin of the organization
   */
  async isOrgAdmin(orgId: number, userId: number): Promise<boolean> {
    const result = await query(
      `SELECT role FROM organization_members
       WHERE organization_id = $1 AND user_id = $2`,
      [orgId, userId]
    );

    if (result.rows.length === 0) {
      return false;
    }

    return result.rows[0].role === 'admin';
  },

  /**
   * Check if user is a member of the organization
   */
  async isMember(orgId: number, userId: number): Promise<boolean> {
    const result = await query(
      'SELECT id FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [orgId, userId]
    );

    return result.rows.length > 0;
  },

  /**
   * Get user's current organization
   */
  async getCurrentOrganization(userId: number): Promise<OrganizationWithRole | null> {
    const result = await query(
      `SELECT o.id, o.name, o.slug, o.owner_id, o.settings, o.created_at, o.updated_at,
              om.role as user_role
       FROM users u
       JOIN organizations o ON u.current_organization_id = o.id
       JOIN organization_members om ON o.id = om.organization_id AND om.user_id = u.id
       WHERE u.id = $1`,
      [userId]
    );

    return result.rows[0] || null;
  },

  /**
   * Delete an organization (only owner can do this)
   */
  async deleteOrganization(orgId: number, userId: number): Promise<void> {
    const org = await this.getOrganization(orgId);

    if (!org) {
      throw Errors.notFound('Organization not found');
    }

    if (org.owner_id !== userId) {
      throw Errors.forbidden('Only the organization owner can delete it');
    }

    // Clear current_organization_id for all users who have this as current
    await query(
      'UPDATE users SET current_organization_id = NULL WHERE current_organization_id = $1',
      [orgId]
    );

    // Delete the organization (cascades to members)
    await query('DELETE FROM organizations WHERE id = $1', [orgId]);
  },
};

export default organizationService;
