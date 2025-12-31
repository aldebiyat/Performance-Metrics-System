import { Router, Request, Response } from 'express';
import { metricsService } from '../services/metricsService';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { ApiResponse, DateRange, CategoryWithMetrics, Category } from '../types';
import { validate, metricsQuerySchema, categoryParamSchema } from '../validators';

const router = Router();

/**
 * @swagger
 * /api/metrics/categories:
 *   get:
 *     summary: Get all metric categories
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all metric categories
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *       401:
 *         description: Unauthorized - Invalid or missing token
 */
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

/**
 * @swagger
 * /api/metrics/summary:
 *   get:
 *     summary: Get metrics summary for all categories
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         required: true
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 12m]
 *         description: Date range for metrics data
 *     responses:
 *       200:
 *         description: Metrics summary for all categories
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
 *                     categories:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           metrics:
 *                             type: array
 *                             items:
 *                               type: object
 *                     overallScore:
 *                       type: number
 *       400:
 *         description: Invalid date range
 *       401:
 *         description: Unauthorized - Invalid or missing token
 */
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

/**
 * @swagger
 * /api/metrics/{category}:
 *   get:
 *     summary: Get metrics by category
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *           enum: [performance, seo, accessibility, best-practices]
 *         description: Category identifier
 *       - in: query
 *         name: range
 *         required: true
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 12m]
 *         description: Date range for metrics data
 *     responses:
 *       200:
 *         description: Metrics data for the specified category
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
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     metrics:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           value:
 *                             type: number
 *                           unit:
 *                             type: string
 *                           trend:
 *                             type: string
 *                             enum: [up, down, stable]
 *       400:
 *         description: Invalid category or date range
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Category not found
 */
router.get(
  '/:category',
  authenticate,
  validate(categoryParamSchema, 'params'),
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
