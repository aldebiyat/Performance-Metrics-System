import { Router, Request, Response } from 'express';
import multer from 'multer';
import { importService } from '../services/importService';
import { auditService } from '../services/auditService';
import { asyncHandler, Errors } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/adminAuth';
import logger from '../config/logger';

const router = Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();

const fileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Accept only CSV files
  if (
    file.mimetype === 'text/csv' ||
    file.mimetype === 'application/vnd.ms-excel' ||
    file.originalname.toLowerCase().endsWith('.csv')
  ) {
    cb(null, true);
  } else {
    cb(new Error('Only CSV files are allowed'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

/**
 * @swagger
 * /api/import/csv:
 *   post:
 *     summary: Import metrics data from CSV file
 *     description: Upload a CSV file to import metrics data. Requires admin privileges.
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV file with columns - category, metric_name, value, recorded_at
 *               validateOnly:
 *                 type: boolean
 *                 description: If true, only validate without importing
 *     responses:
 *       200:
 *         description: Import completed successfully
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
 *                     rowsImported:
 *                       type: integer
 *                     rowsSkipped:
 *                       type: integer
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           row:
 *                             type: integer
 *                           field:
 *                             type: string
 *                           message:
 *                             type: string
 *       400:
 *         description: Bad request - Invalid file or validation errors
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Admin access required
 */
router.post(
  '/csv',
  authenticate,
  requireAdmin,
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            error: {
              code: 'FILE_TOO_LARGE',
              message: 'File size exceeds 5MB limit',
            },
          });
        }
        return res.status(400).json({
          success: false,
          error: {
            code: 'UPLOAD_ERROR',
            message: err.message,
          },
        });
      } else if (err) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_FILE',
            message: err.message,
          },
        });
      }
      next();
    });
  },
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw Errors.badRequest('No file uploaded');
    }

    const validateOnly = req.body.validateOnly === 'true';

    logger.info(`CSV import started by user ${req.user?.userId}`, {
      filename: req.file.originalname,
      size: req.file.size,
      validateOnly,
    });

    // Parse CSV
    let parsedRows;
    try {
      parsedRows = importService.parseCSV(req.file.buffer);
    } catch (error) {
      throw Errors.badRequest(
        error instanceof Error ? error.message : 'Failed to parse CSV file'
      );
    }

    // Validate data
    const validationResult = await importService.validateData(parsedRows);

    if (validateOnly) {
      return res.json({
        success: true,
        data: {
          totalRows: parsedRows.length,
          validRows: validationResult.validRows.length,
          errors: validationResult.errors,
          preview: parsedRows.slice(0, 5),
        },
      });
    }

    // Import data
    const importResult = await importService.importMetrics(validationResult.validRows);

    await auditService.log({
      userId: req.user?.userId,
      action: 'DATA_IMPORTED',
      entityType: 'metrics',
      newValues: {
        filename: req.file.originalname,
        rowsImported: importResult.rowsImported,
        rowsSkipped: importResult.rowsSkipped,
        totalRows: parsedRows.length,
      },
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
    });

    logger.info(`CSV import completed by user ${req.user?.userId}`, {
      rowsImported: importResult.rowsImported,
      rowsSkipped: importResult.rowsSkipped,
      errors: importResult.errors.length,
    });

    res.json({
      success: true,
      data: {
        rowsImported: importResult.rowsImported,
        rowsSkipped: importResult.rowsSkipped,
        totalRows: parsedRows.length,
        errors: [...validationResult.errors, ...importResult.errors],
      },
    });
  })
);

/**
 * @swagger
 * /api/import/template:
 *   get:
 *     summary: Download CSV template for import
 *     description: Get a template CSV file with the expected format for importing metrics.
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV template file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get(
  '/template',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const template = `category,metric_name,value,recorded_at
overview,pageviews,1500,2025-01-15
overview,unique_visitors,800,2025-01-15
traffic,direct_traffic,500,2025-01-15
traffic,organic_search,300,2025-01-15
performance,page_load_time,2.5,2025-01-15
performance,time_to_first_byte,0.8,2025-01-15`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="metrics-import-template.csv"');
    res.send(template);
  })
);

export default router;
