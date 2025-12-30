import { Router, Request, Response } from 'express';
import { metricsService } from '../services/metricsService';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { ApiResponse, DateRange, CategoryWithMetrics, Category } from '../types';

const router = Router();

// Validate date range parameter
const validateRange = (range: string | undefined): DateRange => {
  const validRanges: DateRange[] = ['7d', '30d', '90d', '1y'];
  if (range && validRanges.includes(range as DateRange)) {
    return range as DateRange;
  }
  return '30d';
};

// Get all categories
router.get(
  '/categories',
  authenticate,
  asyncHandler(async (_req: Request, res: Response) => {
    const categories = await metricsService.getCategories();

    const response: ApiResponse<Category[]> = {
      success: true,
      data: categories,
    };

    res.json(response);
  })
);

// Get metrics summary (all categories)
router.get(
  '/summary',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const range = validateRange(req.query.range as string);
    const summary = await metricsService.getSummary(range);

    const response: ApiResponse<typeof summary> = {
      success: true,
      data: summary,
    };

    res.json(response);
  })
);

// Get metrics by category
router.get(
  '/:category',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { category } = req.params;
    const range = validateRange(req.query.range as string);

    const data = await metricsService.getMetricsByCategory(category, range);

    const response: ApiResponse<CategoryWithMetrics> = {
      success: true,
      data,
    };

    res.json(response);
  })
);

export default router;
