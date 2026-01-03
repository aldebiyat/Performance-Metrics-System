import { Request, Response, NextFunction } from 'express';
import { csrfProtection, generateCsrfToken } from '../../middleware/csrf';

describe('CSRF Protection', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      method: 'POST',
      headers: {},
      cookies: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
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
      mockRequest.method = 'POST';
      mockRequest.headers = {};
      mockRequest.cookies = {};

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'CSRF token missing',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject requests with only header token (no cookie)', () => {
      mockRequest.method = 'POST';
      mockRequest.headers = { 'x-csrf-token': 'some-token' };
      mockRequest.cookies = {};

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'CSRF token missing',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject requests with only cookie token (no header)', () => {
      mockRequest.method = 'POST';
      mockRequest.headers = {};
      mockRequest.cookies = { csrf_token: 'some-token' };

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
      mockRequest.method = 'POST';
      mockRequest.headers = { 'x-csrf-token': token };
      mockRequest.cookies = { csrf_token: token };

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should skip CSRF check for GET requests', () => {
      mockRequest.method = 'GET';
      mockRequest.headers = {};
      mockRequest.cookies = {};

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should skip CSRF check for HEAD requests', () => {
      mockRequest.method = 'HEAD';
      mockRequest.headers = {};
      mockRequest.cookies = {};

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should skip CSRF check for OPTIONS requests', () => {
      mockRequest.method = 'OPTIONS';
      mockRequest.headers = {};
      mockRequest.cookies = {};

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject mismatched tokens', () => {
      mockRequest.method = 'POST';
      mockRequest.headers = { 'x-csrf-token': 'header-token-value' };
      mockRequest.cookies = { csrf_token: 'cookie-token-value' };

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'CSRF token invalid',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject tokens of different lengths', () => {
      mockRequest.method = 'POST';
      mockRequest.headers = { 'x-csrf-token': 'short' };
      mockRequest.cookies = { csrf_token: 'much-longer-token-value' };

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'CSRF token invalid',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should require CSRF token for PUT requests', () => {
      mockRequest.method = 'PUT';
      mockRequest.headers = {};
      mockRequest.cookies = {};

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'CSRF token missing',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should require CSRF token for DELETE requests', () => {
      mockRequest.method = 'DELETE';
      mockRequest.headers = {};
      mockRequest.cookies = {};

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'CSRF token missing',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should require CSRF token for PATCH requests', () => {
      mockRequest.method = 'PATCH';
      mockRequest.headers = {};
      mockRequest.cookies = {};

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'CSRF token missing',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
