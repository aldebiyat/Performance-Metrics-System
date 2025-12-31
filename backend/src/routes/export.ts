import { Router, Request, Response } from 'express';
import { exportService } from '../services/exportService';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { DateRange } from '../types';
import { validate, exportQuerySchema, CategoryFilter } from '../validators';

const router = Router();

/**
 * @swagger
 * /api/export/csv:
 *   get:
 *     summary: Export metrics data as CSV
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *           enum: [all, performance, seo, accessibility, best-practices]
 *         description: Category to export (use 'all' for all categories)
 *       - in: query
 *         name: range
 *         required: true
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 12m]
 *         description: Date range for metrics data
 *     responses:
 *       200:
 *         description: CSV file download
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *         headers:
 *           Content-Disposition:
 *             schema:
 *               type: string
 *             description: Attachment with filename
 *       400:
 *         description: Invalid category or date range
 *       401:
 *         description: Unauthorized - Invalid or missing token
 */
router.get(
  '/csv',
  authenticate,
  validate(exportQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { category, range } = req.query as { category: CategoryFilter; range: DateRange };

    const { content, filename } = await exportService.generateCSV(category, range);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  })
);

/**
 * @swagger
 * /api/export/pdf:
 *   get:
 *     summary: Export metrics data as PDF
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *           enum: [all, performance, seo, accessibility, best-practices]
 *         description: Category to export (use 'all' for all categories)
 *       - in: query
 *         name: range
 *         required: true
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 12m]
 *         description: Date range for metrics data
 *     responses:
 *       200:
 *         description: PDF file download
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *         headers:
 *           Content-Disposition:
 *             schema:
 *               type: string
 *             description: Attachment with filename
 *       400:
 *         description: Invalid category or date range
 *       401:
 *         description: Unauthorized - Invalid or missing token
 */
router.get(
  '/pdf',
  authenticate,
  validate(exportQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { category, range } = req.query as { category: CategoryFilter; range: DateRange };

    const { buffer, filename } = await exportService.generatePDF(category, range);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  })
);

export default router;
