import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';

// Store original NODE_ENV
const originalNodeEnv = process.env.NODE_ENV;

// Create mock logger functions before mocking
const mockLoggerError = jest.fn();
const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();
const mockLoggerDebug = jest.fn();

// Mock logger BEFORE importing any modules that use it
jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: {
    info: mockLoggerInfo,
    error: mockLoggerError,
    warn: mockLoggerWarn,
    debug: mockLoggerDebug,
  },
}));

// Mock the authentication middleware
jest.mock('../../middleware/auth', () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    req.user = { userId: 1, role: 'admin' };
    next();
  },
}));

// Mock the admin auth middleware
jest.mock('../../middleware/adminAuth', () => ({
  requireAdmin: (_req: Request, _res: Response, next: NextFunction) => {
    next();
  },
}));

// Mock the import service
jest.mock('../../services/importService', () => ({
  importService: {
    parseCSV: jest.fn(),
    validateData: jest.fn(),
    importMetrics: jest.fn(),
  },
}));

// Mock the audit service
jest.mock('../../services/auditService', () => ({
  auditService: {
    log: jest.fn().mockResolvedValue(undefined),
  },
}));

import importRoutes from '../../routes/import';
import { importService } from '../../services/importService';
import { errorHandler } from '../../middleware/errorHandler';

const mockImportService = importService as jest.Mocked<typeof importService>;

describe('Import Routes - Error Message Verbosity', () => {
  let app: express.Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/import', importRoutes);
    // Add error handler middleware to handle errors from asyncHandler
    app.use(errorHandler);
  });

  afterEach(() => {
    // Restore NODE_ENV after each test
    process.env.NODE_ENV = originalNodeEnv;
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('Multer error handling', () => {
    describe('in production mode', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'production';
      });

      it('should return generic message for file size limit error', async () => {
        // Create a file larger than 5MB limit
        const largeBuffer = Buffer.alloc(6 * 1024 * 1024, 'a');

        const response = await request(app)
          .post('/api/import/csv')
          .attach('file', largeBuffer, 'test.csv');

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('FILE_TOO_LARGE');
        expect(response.body.error.message).toBe('File size exceeds 5MB limit');
      });

      it('should return generic message for multer upload errors', async () => {
        // Test with an invalid field name to trigger a multer error
        const response = await request(app)
          .post('/api/import/csv')
          .attach('wrongFieldName', Buffer.from('test'), 'test.csv');

        expect(response.status).toBe(400);
        // In production, should not expose internal multer error details
        expect(response.body.error.message).toBe('File upload failed');
      });

      it('should return generic message for invalid file type', async () => {
        const response = await request(app)
          .post('/api/import/csv')
          .attach('file', Buffer.from('test content'), {
            filename: 'test.exe',
            contentType: 'application/octet-stream',
          });

        expect(response.status).toBe(400);
        // In production, should not expose detailed file validation error
        expect(response.body.error.message).toBe('Invalid file');
      });

      it('should log multer errors server-side in production', async () => {
        await request(app)
          .post('/api/import/csv')
          .attach('wrongFieldName', Buffer.from('test'), 'test.csv');

        // Verify the error was logged server-side
        expect(mockLoggerError).toHaveBeenCalledWith(
          'Multer upload error',
          expect.objectContaining({
            code: expect.any(String),
            message: expect.any(String),
          })
        );
      });
    });

    describe('in development mode', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'development';
      });

      it('should return detailed message for multer upload errors', async () => {
        const response = await request(app)
          .post('/api/import/csv')
          .attach('wrongFieldName', Buffer.from('test'), 'test.csv');

        expect(response.status).toBe(400);
        // In development, should include the actual error message
        expect(response.body.error.message).not.toBe('File upload failed');
      });

      it('should return detailed message for invalid file type', async () => {
        const response = await request(app)
          .post('/api/import/csv')
          .attach('file', Buffer.from('test content'), {
            filename: 'test.exe',
            contentType: 'application/octet-stream',
          });

        expect(response.status).toBe(400);
        // In development, should include the actual error message
        expect(response.body.error.message).toContain('CSV');
      });
    });
  });

  describe('CSV parsing error handling', () => {
    describe('in production mode', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'production';
      });

      it('should return generic message for CSV parsing errors', async () => {
        const csvContent = 'category,metric_name,value,recorded_at\noverview,test,100,2025-01-01';

        mockImportService.parseCSV.mockImplementation(() => {
          throw new Error('Missing required headers: some_header');
        });

        const response = await request(app)
          .post('/api/import/csv')
          .attach('file', Buffer.from(csvContent), {
            filename: 'test.csv',
            contentType: 'text/csv',
          });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toBe('Failed to parse CSV file');
      });

      it('should not expose internal error details in CSV parsing', async () => {
        const csvContent = 'category,metric_name,value,recorded_at\noverview,test,100,2025-01-01';

        mockImportService.parseCSV.mockImplementation(() => {
          throw new Error('Internal database connection failed at line 42');
        });

        const response = await request(app)
          .post('/api/import/csv')
          .attach('file', Buffer.from(csvContent), {
            filename: 'test.csv',
            contentType: 'text/csv',
          });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toBe('Failed to parse CSV file');
        expect(response.body.error.message).not.toContain('database');
        expect(response.body.error.message).not.toContain('line 42');
      });

      it('should log CSV parsing errors server-side in production', async () => {
        const csvContent = 'category,metric_name,value,recorded_at\noverview,test,100,2025-01-01';

        mockImportService.parseCSV.mockImplementation(() => {
          throw new Error('Internal database connection failed');
        });

        await request(app)
          .post('/api/import/csv')
          .attach('file', Buffer.from(csvContent), {
            filename: 'test.csv',
            contentType: 'text/csv',
          });

        // Verify the detailed error was logged server-side
        expect(mockLoggerError).toHaveBeenCalledWith(
          'CSV parsing error',
          expect.objectContaining({
            message: 'Internal database connection failed',
            filename: 'test.csv',
          })
        );
      });
    });

    describe('in development mode', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'development';
      });

      it('should return detailed message for CSV parsing errors', async () => {
        const csvContent = 'category,metric_name,value,recorded_at\noverview,test,100,2025-01-01';

        mockImportService.parseCSV.mockImplementation(() => {
          throw new Error('Missing required headers: some_header');
        });

        const response = await request(app)
          .post('/api/import/csv')
          .attach('file', Buffer.from(csvContent), {
            filename: 'test.csv',
            contentType: 'text/csv',
          });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toBe('Missing required headers: some_header');
      });

      it('should return generic error for non-Error exceptions', async () => {
        const csvContent = 'category,metric_name,value,recorded_at\noverview,test,100,2025-01-01';

        mockImportService.parseCSV.mockImplementation(() => {
          throw 'String error thrown';
        });

        const response = await request(app)
          .post('/api/import/csv')
          .attach('file', Buffer.from(csvContent), {
            filename: 'test.csv',
            contentType: 'text/csv',
          });

        expect(response.status).toBe(400);
        // For non-Error exceptions, should still show a safe message even in development
        expect(response.body.error.message).toBe('Failed to parse CSV file');
      });
    });
  });

  describe('Error logging', () => {
    it('should log detailed error server-side regardless of environment', async () => {
      process.env.NODE_ENV = 'production';

      const csvContent = 'category,metric_name,value,recorded_at\noverview,test,100,2025-01-01';

      mockImportService.parseCSV.mockImplementation(() => {
        throw new Error('Detailed internal error for logging');
      });

      await request(app)
        .post('/api/import/csv')
        .attach('file', Buffer.from(csvContent), {
          filename: 'test.csv',
          contentType: 'text/csv',
        });

      // The detailed error should be logged server-side
      expect(mockLoggerError).toHaveBeenCalledWith(
        'CSV parsing error',
        expect.objectContaining({
          message: 'Detailed internal error for logging',
        })
      );
    });
  });
});
