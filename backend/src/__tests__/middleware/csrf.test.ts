import { Request, Response, NextFunction } from 'express';
import { csrfProtection, generateCsrfToken, setCsrfCookie } from '../../middleware/csrf';

// Extended type to allow setting path in tests
interface MockRequest extends Partial<Request> {
  path: string;
}

describe('CSRF Protection', () => {
  let mockRequest: MockRequest;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  const createMockRequest = (overrides: Partial<MockRequest> = {}): MockRequest => ({
    method: 'POST',
    path: '/api/some-endpoint',
    headers: {},
    cookies: {},
    ...overrides,
  });

  beforeEach(() => {
    mockRequest = createMockRequest();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('generateCsrfToken', () => {
    it('should generate a 64-character hex token', () => {
      const token = generateCsrfToken();

      expect(typeof token).toBe('string');
      expect(token).toHaveLength(64); // 32 bytes = 64 hex characters
      expect(/^[a-f0-9]+$/.test(token)).toBe(true);
    });

    it('should generate unique tokens on each call', () => {
      const token1 = generateCsrfToken();
      const token2 = generateCsrfToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe('csrfProtection middleware', () => {
    it('should reject POST requests without CSRF token', () => {
      mockRequest = createMockRequest({ method: 'POST', path: '/api/protected' });

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'CSRF token missing',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject requests with only header token (no cookie)', () => {
      mockRequest = createMockRequest({
        method: 'POST',
        path: '/api/protected',
        headers: { 'x-csrf-token': 'some-token' },
      });

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'CSRF token missing',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject requests with only cookie token (no header)', () => {
      mockRequest = createMockRequest({
        method: 'POST',
        path: '/api/protected',
        cookies: { csrf_token: 'some-token' },
      });

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'CSRF token missing',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow requests with valid matching CSRF tokens', () => {
      const token = generateCsrfToken();
      mockRequest = createMockRequest({
        method: 'POST',
        path: '/api/protected',
        headers: { 'x-csrf-token': token },
        cookies: { csrf_token: token },
      });

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should skip CSRF check for GET requests', () => {
      mockRequest = createMockRequest({ method: 'GET', path: '/api/protected' });

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should skip CSRF check for HEAD requests', () => {
      mockRequest = createMockRequest({ method: 'HEAD', path: '/api/protected' });

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should skip CSRF check for OPTIONS requests', () => {
      mockRequest = createMockRequest({ method: 'OPTIONS', path: '/api/protected' });

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject mismatched tokens', () => {
      mockRequest = createMockRequest({
        method: 'POST',
        path: '/api/protected',
        headers: { 'x-csrf-token': 'header-token-value' },
        cookies: { csrf_token: 'cookie-token-value' },
      });

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'CSRF token invalid',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject tokens of different lengths', () => {
      mockRequest = createMockRequest({
        method: 'POST',
        path: '/api/protected',
        headers: { 'x-csrf-token': 'short' },
        cookies: { csrf_token: 'much-longer-token-value' },
      });

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'CSRF token invalid',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should require CSRF token for PUT requests', () => {
      mockRequest = createMockRequest({ method: 'PUT', path: '/api/protected' });

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'CSRF token missing',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should require CSRF token for DELETE requests', () => {
      mockRequest = createMockRequest({ method: 'DELETE', path: '/api/protected' });

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'CSRF token missing',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should require CSRF token for PATCH requests', () => {
      mockRequest = createMockRequest({ method: 'PATCH', path: '/api/protected' });

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'CSRF token missing',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    describe('exempt paths', () => {
      it('should skip CSRF check for /api/auth/login', () => {
        mockRequest = createMockRequest({ method: 'POST', path: '/api/auth/login' });

        csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockResponse.status).not.toHaveBeenCalled();
      });

      it('should skip CSRF check for /api/auth/register', () => {
        mockRequest = createMockRequest({ method: 'POST', path: '/api/auth/register' });

        csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockResponse.status).not.toHaveBeenCalled();
      });

      it('should skip CSRF check for /api/auth/forgot-password', () => {
        mockRequest = createMockRequest({ method: 'POST', path: '/api/auth/forgot-password' });

        csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockResponse.status).not.toHaveBeenCalled();
      });

      it('should skip CSRF check for /api/auth/reset-password', () => {
        mockRequest = createMockRequest({ method: 'POST', path: '/api/auth/reset-password' });

        csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockResponse.status).not.toHaveBeenCalled();
      });

      it('should skip CSRF check for /api/auth/refresh', () => {
        mockRequest = createMockRequest({ method: 'POST', path: '/api/auth/refresh' });

        csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockResponse.status).not.toHaveBeenCalled();
      });

      it('should still require CSRF for /api/auth/logout (authenticated endpoint)', () => {
        mockRequest = createMockRequest({ method: 'POST', path: '/api/auth/logout' });

        csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockResponse.status).toHaveBeenCalledWith(403);
        expect(mockNext).not.toHaveBeenCalled();
      });
    });
  });

  describe('setCsrfCookie', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should set cookie with correct attributes in development', () => {
      process.env.NODE_ENV = 'development';
      const token = 'test-csrf-token';

      setCsrfCookie(mockResponse as Response, token);

      expect(mockResponse.cookie).toHaveBeenCalledWith('csrf_token', token, {
        httpOnly: false,
        secure: false,
        sameSite: 'strict',
        path: '/',
      });
    });

    it('should set secure cookie in production', () => {
      process.env.NODE_ENV = 'production';
      const token = 'test-csrf-token';

      setCsrfCookie(mockResponse as Response, token);

      expect(mockResponse.cookie).toHaveBeenCalledWith('csrf_token', token, {
        httpOnly: false,
        secure: true,
        sameSite: 'strict',
        path: '/',
      });
    });
  });
});
