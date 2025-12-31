import { z } from 'zod';

export const dateRangeSchema = z.enum(['7d', '30d', '90d', '1y']).default('30d');

export const categorySchema = z.enum(['overview', 'traffic', 'performance', 'all']).default('all');

export const categoryParamSchema = z.object({
  category: z.string().min(1, 'Category is required'),
});

export const metricsQuerySchema = z.object({
  range: dateRangeSchema,
});

export const exportQuerySchema = z.object({
  range: dateRangeSchema,
  category: categorySchema,
});

export type DateRange = z.infer<typeof dateRangeSchema>;
export type CategoryFilter = z.infer<typeof categorySchema>;
