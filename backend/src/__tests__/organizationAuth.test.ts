import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';

// Mock database module
jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

// Import after mocking
import { query } from '../config/database';
import {
  requireOrganization,
  validateOrganizationAccess,
  requireOrgAdmin,
} from '../middleware/organizationAuth';

const mockQuery = query as jest.MockedFunction<typeof query>;

// Helper to create mock request
const createMockRequest = (overrides: Partial<Request> = {}): Request => {
  return {
    user: { userId: 1, email: 'test@example.com', role: 'viewer' },
    params: {},
    ...overrides,
  } as Request;
};

// Helper to create mock response
const createMockResponse = (): Response => {
  return {} as Response;
};

// Helper to create mock next function
const createMockNext = (): NextFunction => jest.fn();

describe('Organization Auth Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requireOrganization', () => {
    it('should throw unauthorized error if user is not authenticated', async () => {
      const req = createMockRequest({ user: undefined });
      const res = createMockResponse();
      const next = createMockNext();

      await expect(requireOrganization(req, res, next)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Not authenticated',
      });
    });

    it('should throw forbidden error if user has no organization', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      // Mock: user found but no current_organization_id
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          email: 'test@example.com',
          current_organization_id: null,
        }],
        rowCount: 1,
      } as any);

      await expect(requireOrganization(req, res, next)).rejects.toMatchObject({
        statusCode: 403,
        message: 'No organization selected',
      });
    });

    it('should throw forbidden error if user is not a member of their current organization', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      // Mock: user found with current_organization_id
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          email: 'test@example.com',
          current_organization_id: 10,
        }],
        rowCount: 1,
      } as any);

      // Mock: membership check - no membership found
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

      await expect(requireOrganization(req, res, next)).rejects.toMatchObject({
        statusCode: 403,
        message: 'Not a member of this organization',
      });
    });

    it('should set organizationId and organizationRole on request if user has valid organization membership', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      // Mock: user found with current_organization_id
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          email: 'test@example.com',
          current_organization_id: 10,
        }],
        rowCount: 1,
      } as any);

      // Mock: membership check - membership found
      mockQuery.mockResolvedValueOnce({
        rows: [{ role: 'member' }],
        rowCount: 1,
      } as any);

      await requireOrganization(req, res, next);

      expect(req.organizationId).toBe(10);
      expect(req.organizationRole).toBe('member');
      expect(next).toHaveBeenCalled();
    });

    it('should set organizationRole to admin when user is org admin', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      // Mock: user found with current_organization_id
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          email: 'test@example.com',
          current_organization_id: 10,
        }],
        rowCount: 1,
      } as any);

      // Mock: membership check - admin membership found
      mockQuery.mockResolvedValueOnce({
        rows: [{ role: 'admin' }],
        rowCount: 1,
      } as any);

      await requireOrganization(req, res, next);

      expect(req.organizationId).toBe(10);
      expect(req.organizationRole).toBe('admin');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('validateOrganizationAccess', () => {
    it('should throw forbidden error if trying to access different org data', () => {
      const req = createMockRequest({
        organizationId: 10,
        params: { orgId: '20' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      expect(() => validateOrganizationAccess(req, res, next)).toThrow(AppError);

      try {
        validateOrganizationAccess(req, res, next);
      } catch (error) {
        expect(error).toMatchObject({
          statusCode: 403,
          message: 'Access denied to this organization',
        });
      }
    });

    it('should allow access to own organization', () => {
      const req = createMockRequest({
        organizationId: 10,
        params: { orgId: '10' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      validateOrganizationAccess(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should throw forbidden error if organizationId not set on request', () => {
      const req = createMockRequest({
        organizationId: undefined,
        params: { orgId: '10' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      expect(() => validateOrganizationAccess(req, res, next)).toThrow(AppError);

      try {
        validateOrganizationAccess(req, res, next);
      } catch (error) {
        expect(error).toMatchObject({
          statusCode: 403,
          message: 'Organization context not established',
        });
      }
    });
  });

  describe('requireOrgAdmin', () => {
    it('should throw forbidden error if user is not org admin', () => {
      const req = createMockRequest({
        organizationId: 10,
        organizationRole: 'member',
      });
      const res = createMockResponse();
      const next = createMockNext();

      expect(() => requireOrgAdmin(req, res, next)).toThrow(AppError);

      try {
        requireOrgAdmin(req, res, next);
      } catch (error) {
        expect(error).toMatchObject({
          statusCode: 403,
          message: 'Organization admin access required',
        });
      }
    });

    it('should allow access if user is org admin', () => {
      const req = createMockRequest({
        organizationId: 10,
        organizationRole: 'admin',
      });
      const res = createMockResponse();
      const next = createMockNext();

      requireOrgAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should throw forbidden error if organizationRole not set', () => {
      const req = createMockRequest({
        organizationId: 10,
        organizationRole: undefined,
      });
      const res = createMockResponse();
      const next = createMockNext();

      expect(() => requireOrgAdmin(req, res, next)).toThrow(AppError);

      try {
        requireOrgAdmin(req, res, next);
      } catch (error) {
        expect(error).toMatchObject({
          statusCode: 403,
          message: 'Organization admin access required',
        });
      }
    });
  });
});
