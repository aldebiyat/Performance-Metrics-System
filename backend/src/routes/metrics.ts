import { Router, Request, Response } from 'express';
import { metricsService } from '../services/metricsService';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { ApiResponse, DateRange, CategoryWithMetrics, Category } from '../types';
import { validate, metricsQuerySchema } from '../validators';

const router = Router();

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
  validate(metricsQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { range } = req.query as { range: DateRange };
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
  validate(metricsQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { category } = req.params;
    const { range } = req.query as { range: DateRange };

    const data = await metricsService.getMetricsByCategory(category, range);

    const response: ApiResponse<CategoryWithMetrics> = {
      success: true,
      data,
    };

    res.json(response);
  })
);

export default router;
