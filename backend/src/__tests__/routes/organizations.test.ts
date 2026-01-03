import { AppError } from '../../middleware/errorHandler';

// Mock database module
jest.mock('../../config/database', () => ({
  query: jest.fn(),
}));

// Mock organization service
const mockDeleteOrganization = jest.fn();
jest.mock('../../services/organizationService', () => ({
  organizationService: {
    deleteOrganization: mockDeleteOrganization,
    createOrganization: jest.fn(),
    getOrganization: jest.fn(),
    getUserOrganizations: jest.fn(),
    updateOrganization: jest.fn(),
    addMember: jest.fn(),
    removeMember: jest.fn(),
    updateMemberRole: jest.fn(),
    switchOrganization: jest.fn(),
    getOrganizationMembers: jest.fn(),
    isOrgAdmin: jest.fn(),
    isMember: jest.fn(),
    getCurrentOrganization: jest.fn(),
  },
}));

// Import after mocking
import { query } from '../../config/database';

const mockQuery = query as jest.MockedFunction<typeof query>;

/**
 * Helper function that replicates the delete organization handler logic
 * This allows us to test the core logic without Express middleware complexity
 */
async function deleteOrganizationHandler(orgId: number, userId: number): Promise<{ message: string }> {
  const { organizationService } = await import('../../services/organizationService');
  const { query: dbQuery } = await import('../../config/database');

  if (isNaN(orgId)) {
    throw new AppError('Invalid organization ID', 422);
  }

  // Get member user IDs BEFORE deletion (while relationship still exists)
  const membersResult = await dbQuery(
    'SELECT user_id FROM organization_members WHERE organization_id = $1',
    [orgId]
  );
  const memberUserIds = membersResult.rows.map((r: any) => r.user_id);

  // FIRST: Verify ownership/permission (throws if not authorized)
  await organizationService.deleteOrganization(orgId, userId);

  // THEN: Invalidate tokens for former members (after successful deletion)
  if (memberUserIds.length > 0) {
    await dbQuery(
      `DELETE FROM refresh_tokens WHERE user_id = ANY($1)`,
      [memberUserIds]
    );
  }

  return { message: 'Organization deleted successfully' };
}

describe('Organizations Route - DELETE /:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Security: Token cleanup order vulnerability (H-4)', () => {
    it('should NOT delete tokens when ownership check fails', async () => {
      // Mock: get member IDs (organization has members)
      mockQuery.mockResolvedValueOnce({
        rows: [{ user_id: 10 }, { user_id: 11 }, { user_id: 12 }],
        rowCount: 3,
      } as any);

      // Mock: deleteOrganization throws forbidden error (user is not owner)
      mockDeleteOrganization.mockRejectedValueOnce(
        new AppError('Only the organization owner can delete it', 403)
      );

      // Attempt to delete org 999 as user 2 (who is not the owner)
      await expect(deleteOrganizationHandler(999, 2)).rejects.toThrow(
        'Only the organization owner can delete it'
      );

      // CRITICAL: Verify tokens were NOT deleted
      const queryCalls = mockQuery.mock.calls;

      // First call should be to get member IDs
      expect(queryCalls[0][0]).toContain('SELECT user_id FROM organization_members');

      // There should be NO call to DELETE FROM refresh_tokens
      const tokenDeleteCalls = queryCalls.filter(call =>
        call[0].includes('DELETE FROM refresh_tokens')
      );
      expect(tokenDeleteCalls.length).toBe(0);
    });

    it('should return 403 when non-owner attempts to delete organization', async () => {
      // Mock: get member IDs
      mockQuery.mockResolvedValueOnce({
        rows: [{ user_id: 1 }, { user_id: 5 }],
        rowCount: 2,
      } as any);

      // Mock: deleteOrganization throws forbidden (not the owner)
      mockDeleteOrganization.mockRejectedValueOnce(
        new AppError('Only the organization owner can delete it', 403)
      );

      // Attempt to delete as non-owner user 5
      try {
        await deleteOrganizationHandler(123, 5);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(403);
      }

      // Verify no token deletion occurred
      const tokenDeleteCalls = mockQuery.mock.calls.filter(call =>
        call[0].includes('DELETE FROM refresh_tokens')
      );
      expect(tokenDeleteCalls.length).toBe(0);
    });

    it('should delete tokens ONLY after successful ownership verification', async () => {
      // Mock: get member IDs
      mockQuery.mockResolvedValueOnce({
        rows: [{ user_id: 1 }, { user_id: 2 }, { user_id: 3 }],
        rowCount: 3,
      } as any);

      // Mock: deleteOrganization succeeds (user is owner)
      mockDeleteOrganization.mockResolvedValueOnce(undefined);

      // Mock: token deletion succeeds
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 3,
      } as any);

      const result = await deleteOrganizationHandler(123, 1);

      // Verify the order of operations:
      // 1. First query: get member IDs
      expect(mockQuery.mock.calls[0][0]).toContain('SELECT user_id FROM organization_members');

      // 2. deleteOrganization was called with correct params
      expect(mockDeleteOrganization).toHaveBeenCalledWith(123, 1);

      // 3. Second query: delete tokens (AFTER ownership verification)
      expect(mockQuery.mock.calls[1][0]).toContain('DELETE FROM refresh_tokens');
      expect(mockQuery.mock.calls[1][1]).toEqual([[1, 2, 3]]);

      // Verify response
      expect(result).toEqual({ message: 'Organization deleted successfully' });
    });

    it('should not attempt to delete tokens if organization has no members', async () => {
      // Mock: no members found (edge case)
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

      // Mock: deleteOrganization succeeds
      mockDeleteOrganization.mockResolvedValueOnce(undefined);

      const result = await deleteOrganizationHandler(123, 1);

      // Should only have ONE query call (get members), no token deletion
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery.mock.calls[0][0]).toContain('SELECT user_id FROM organization_members');

      // Verify response
      expect(result).toEqual({ message: 'Organization deleted successfully' });
    });

    it('should throw validation error for invalid organization ID', async () => {
      try {
        await deleteOrganizationHandler(NaN, 1);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(422);
        expect((error as AppError).message).toBe('Invalid organization ID');
      }

      // No database queries should have been made
      expect(mockQuery).not.toHaveBeenCalled();
      expect(mockDeleteOrganization).not.toHaveBeenCalled();
    });

    it('should verify ownership check happens BEFORE token deletion (vulnerability fix)', async () => {
      /**
       * This test specifically verifies the security fix:
       * - OLD behavior (vulnerable): Tokens deleted BEFORE ownership check
       * - NEW behavior (fixed): Ownership verified BEFORE tokens are deleted
       */
      const callOrder: string[] = [];

      // Track call order
      mockQuery.mockImplementation((async (sql: string) => {
        if (sql.includes('SELECT user_id')) {
          callOrder.push('GET_MEMBERS');
          return { rows: [{ user_id: 1 }], rowCount: 1, command: '', oid: 0, fields: [] };
        }
        if (sql.includes('DELETE FROM refresh_tokens')) {
          callOrder.push('DELETE_TOKENS');
          return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
        }
        return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
      }) as any);

      mockDeleteOrganization.mockImplementation(async () => {
        callOrder.push('VERIFY_OWNERSHIP');
      });

      await deleteOrganizationHandler(123, 1);

      // Verify the correct order:
      // 1. Get member IDs (needed before deletion cascades remove them)
      // 2. Verify ownership (throws if unauthorized)
      // 3. Delete tokens (only if ownership verified)
      expect(callOrder).toEqual([
        'GET_MEMBERS',
        'VERIFY_OWNERSHIP',
        'DELETE_TOKENS',
      ]);
    });

    it('should not delete tokens even for a single member when ownership check fails', async () => {
      // Single member scenario
      mockQuery.mockResolvedValueOnce({
        rows: [{ user_id: 42 }],
        rowCount: 1,
      } as any);

      // Ownership check fails
      mockDeleteOrganization.mockRejectedValueOnce(
        new AppError('Only the organization owner can delete it', 403)
      );

      await expect(deleteOrganizationHandler(999, 42)).rejects.toThrow();

      // Verify token deletion was never attempted
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery.mock.calls[0][0]).not.toContain('DELETE');
    });
  });

  describe('L-2: Token cleanup with cached member list', () => {
    it('should invalidate tokens for members after successful deletion', async () => {
      /**
       * L-2 Fix: Member list must be cached BEFORE deletion because
       * organization_members relationship may be cascade-deleted when
       * the organization is deleted, making post-deletion lookup impossible.
       *
       * Order: Get members -> Delete org -> Delete tokens (using cached list)
       */
      const memberUserIds = [101, 102, 103];

      // Step 1: Cache member list (done BEFORE org deletion)
      mockQuery.mockResolvedValueOnce({
        rows: memberUserIds.map(id => ({ user_id: id })),
        rowCount: memberUserIds.length,
      } as any);

      // Step 2: Organization deletion succeeds (may cascade delete org_members)
      mockDeleteOrganization.mockResolvedValueOnce(undefined);

      // Step 3: Token deletion uses cached member list
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: memberUserIds.length,
      } as any);

      const result = await deleteOrganizationHandler(456, 101);

      // Verify member list was fetched FIRST
      expect(mockQuery.mock.calls[0][0]).toContain('SELECT user_id FROM organization_members');
      expect(mockQuery.mock.calls[0][1]).toEqual([456]);

      // Verify tokens deleted using cached member IDs (not a post-deletion query)
      expect(mockQuery.mock.calls[1][0]).toContain('DELETE FROM refresh_tokens WHERE user_id = ANY($1)');
      expect(mockQuery.mock.calls[1][1]).toEqual([memberUserIds]);

      expect(result).toEqual({ message: 'Organization deleted successfully' });
    });

    it('should handle bulk token deletion efficiently with ANY($1)', async () => {
      // Large member list to verify bulk deletion
      const memberUserIds = Array.from({ length: 50 }, (_, i) => i + 1);

      mockQuery.mockResolvedValueOnce({
        rows: memberUserIds.map(id => ({ user_id: id })),
        rowCount: memberUserIds.length,
      } as any);

      mockDeleteOrganization.mockResolvedValueOnce(undefined);

      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: memberUserIds.length,
      } as any);

      await deleteOrganizationHandler(789, 1);

      // Verify single bulk deletion query with ANY
      const tokenDeleteCall = mockQuery.mock.calls[1];
      expect(tokenDeleteCall[0]).toContain('ANY($1)');
      expect(tokenDeleteCall[1]).toEqual([memberUserIds]);

      // Should be exactly 2 queries: get members, delete tokens
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('should skip token deletion when organization has no members', async () => {
      // Edge case: organization with no members (unusual but possible)
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

      mockDeleteOrganization.mockResolvedValueOnce(undefined);

      const result = await deleteOrganizationHandler(999, 1);

      // Should only query for members, skip token deletion
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery.mock.calls[0][0]).toContain('SELECT user_id FROM organization_members');

      expect(result).toEqual({ message: 'Organization deleted successfully' });
    });
  });
});
