import { Request, Response, NextFunction } from 'express';
import { AppError, Errors, errorHandler, asyncHandler } from '../middleware/errorHandler';

// Mock the logger
jest.mock('../config/logger', () => {
  const mockLogger = {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };
  return {
    __esModule: true,
    default: mockLogger,
  };
});

describe('Error Handler Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      requestId: 'test-request-id',
      path: '/test',
      method: 'GET',
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('AppError class', () => {
    it('should create an error with default values', () => {
      const error = new AppError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.isOperational).toBe(true);
      expect(error.stack).toBeDefined();
    });

    it('should create an error with custom status code and code', () => {
      const error = new AppError('Custom error', 404, 'NOT_FOUND');

      expect(error.message).toBe('Custom error');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });
  });

  describe('Errors factory', () => {
    it('should create a badRequest error (400)', () => {
      const error = Errors.badRequest('Invalid input');

      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.message).toBe('Invalid input');
    });

    it('should create a badRequest error with default message', () => {
      const error = Errors.badRequest();

      expect(error.message).toBe('Bad request');
    });

    it('should create an unauthorized error (401)', () => {
      const error = Errors.unauthorized('Not logged in');

      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.message).toBe('Not logged in');
    });

    it('should create an unauthorized error with default message', () => {
      const error = Errors.unauthorized();

      expect(error.message).toBe('Unauthorized');
    });

    it('should create a forbidden error (403)', () => {
      const error = Errors.forbidden('Access denied');

      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
      expect(error.message).toBe('Access denied');
    });

    it('should create a forbidden error with default message', () => {
      const error = Errors.forbidden();

      expect(error.message).toBe('Forbidden');
    });

    it('should create a notFound error (404)', () => {
      const error = Errors.notFound('User not found');

      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe('User not found');
    });

    it('should create a notFound error with default message', () => {
      const error = Errors.notFound();

      expect(error.message).toBe('Resource not found');
    });

    it('should create a conflict error (409)', () => {
      const error = Errors.conflict('Email already exists');

      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
      expect(error.message).toBe('Email already exists');
    });

    it('should create a conflict error with default message', () => {
      const error = Errors.conflict();

      expect(error.message).toBe('Conflict');
    });

    it('should create a validation error (422)', () => {
      const error = Errors.validation('Invalid email format');

      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(422);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Invalid email format');
    });

    it('should create a validation error with default message', () => {
      const error = Errors.validation();

      expect(error.message).toBe('Validation error');
    });

    it('should create an internal error (500)', () => {
      const error = Errors.internal('Database connection failed');

      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.message).toBe('Database connection failed');
    });

    it('should create an internal error with default message', () => {
      const error = Errors.internal();

      expect(error.message).toBe('Internal server error');
    });
  });

  describe('errorHandler middleware', () => {
    it('should handle AppError correctly', () => {
      const error = new AppError('Not found', 404, 'NOT_FOUND');

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Not found',
        },
      });
    });

    it('should handle unknown errors as 500', () => {
      const error = new Error('Something went wrong');

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong',
        },
      });
    });

    it('should handle JsonWebTokenError', () => {
      const error = new Error('jwt malformed');
      error.name = 'JsonWebTokenError';

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid token',
        },
      });
    });

    it('should handle TokenExpiredError', () => {
      const error = new Error('jwt expired');
      error.name = 'TokenExpiredError';

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token has expired',
        },
      });
    });

    it('should hide error details in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Sensitive database error');

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      });

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('asyncHandler', () => {
    it('should pass successful async function result', async () => {
      const asyncFn = jest.fn().mockResolvedValue({ data: 'success' });
      const handler = asyncHandler(asyncFn);

      await handler(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(asyncFn).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should catch and pass errors to next', async () => {
      const error = new Error('Async error');
      const asyncFn = jest.fn().mockRejectedValue(error);
      const handler = asyncHandler(asyncFn);

      await handler(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(asyncFn).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should catch AppError and pass to next', async () => {
      const appError = Errors.notFound('Resource not found');
      const asyncFn = jest.fn().mockRejectedValue(appError);
      const handler = asyncHandler(asyncFn);

      await handler(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(appError);
    });
  });
});
