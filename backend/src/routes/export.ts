import { Router, Request, Response } from 'express';
import { exportService } from '../services/exportService';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { DateRange } from '../types';
import { validate, exportQuerySchema, CategoryFilter } from '../validators';

const router = Router();

// Export as CSV
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

// Export as PDF
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
