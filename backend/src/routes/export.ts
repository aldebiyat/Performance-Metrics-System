import { Router, Request, Response } from 'express';
import { exportService } from '../services/exportService';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { DateRange } from '../types';

const router = Router();

// Validate date range parameter
const validateRange = (range: string | undefined): DateRange => {
  const validRanges: DateRange[] = ['7d', '30d', '90d', '1y'];
  if (range && validRanges.includes(range as DateRange)) {
    return range as DateRange;
  }
  return '30d';
};

// Validate category parameter
const validateCategory = (category: string | undefined): string => {
  if (!category) return 'all';
  const validCategories = ['all', 'overview', 'traffic', 'performance'];
  return validCategories.includes(category) ? category : 'all';
};

// Export as CSV
router.get(
  '/csv',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const category = validateCategory(req.query.category as string);
    const range = validateRange(req.query.range as string);

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
  asyncHandler(async (req: Request, res: Response) => {
    const category = validateCategory(req.query.category as string);
    const range = validateRange(req.query.range as string);

    const { buffer, filename } = await exportService.generatePDF(category, range);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  })
);

export default router;
