import { query } from '../config/database';
import { Category, MetricWithValue, CategoryWithMetrics, DateRange } from '../types';
import { cacheService } from './cacheService';
import { Errors } from '../middleware/errorHandler';

// Convert date range to SQL interval
const getRangeInterval = (range: DateRange): string => {
  switch (range) {
    case '7d': return '7 days';
    case '30d': return '30 days';
    case '90d': return '90 days';
    case '1y': return '1 year';
    default: return '30 days';
  }
};

// Calculate date range
const getDateRange = (range: DateRange): { from: string; to: string } => {
  const to = new Date();
  const from = new Date();

  switch (range) {
    case '7d': from.setDate(from.getDate() - 7); break;
    case '30d': from.setDate(from.getDate() - 30); break;
    case '90d': from.setDate(from.getDate() - 90); break;
    case '1y': from.setFullYear(from.getFullYear() - 1); break;
  }

  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
};

export const metricsService = {
  async getCategories(): Promise<Category[]> {
    const cacheKey = 'categories:all';

    const { data } = await cacheService.getOrSet(
      cacheKey,
      async () => {
        const result = await query(
          'SELECT id, slug, name, display_order, created_at FROM categories ORDER BY display_order'
        );
        return result.rows;
      },
      300 // Cache for 5 minutes
    );

    return data;
  },

  async getMetricsByCategory(
    categorySlug: string,
    range: DateRange = '30d'
  ): Promise<CategoryWithMetrics> {
    const cacheKey = cacheService.metricsKey(categorySlug, range);

    const result = await cacheService.getOrSet(
      cacheKey,
      async () => {
        // Get category
        const categoryResult = await query(
          'SELECT id, slug, name FROM categories WHERE slug = $1',
          [categorySlug]
        );

        if (categoryResult.rows.length === 0) {
          throw Errors.notFound(`Category '${categorySlug}' not found`);
        }

        const category = categoryResult.rows[0];
        const dateRange = getDateRange(range);

        // Get metrics with latest values within range
        const metricsResult = await query(
          `SELECT DISTINCT ON (md.id)
             md.id,
             md.name,
             md.slug,
             md.description,
             md.icon,
             mv.metric_count as count,
             mv.week_over_week_change as "weekOverWeekChange",
             mv.percentile,
             mv.recorded_at as "recordedAt"
           FROM metric_definitions md
           LEFT JOIN metric_values mv ON mv.metric_id = md.id
             AND mv.recorded_at >= $2::date
             AND mv.recorded_at <= $3::date
           WHERE md.category_id = $1
             AND md.is_active = true
           ORDER BY md.id, mv.recorded_at DESC`,
          [category.id, dateRange.from, dateRange.to]
        );

        const metrics: MetricWithValue[] = metricsResult.rows.map(row => ({
          id: row.id,
          name: row.name,
          slug: row.slug,
          description: row.description,
          icon: row.icon,
          count: row.count || 0,
          weekOverWeekChange: row.weekOverWeekChange,
          percentile: row.percentile,
          recordedAt: row.recordedAt ? row.recordedAt.toISOString().split('T')[0] : null,
        }));

        return {
          category: {
            id: category.id,
            slug: category.slug,
            name: category.name,
          },
          metrics,
          dateRange,
        };
      },
      60 // Cache for 1 minute
    );

    return result.data;
  },

  async getAllMetrics(range: DateRange = '30d'): Promise<CategoryWithMetrics[]> {
    const categories = await this.getCategories();
    const results: CategoryWithMetrics[] = [];

    for (const category of categories) {
      const data = await this.getMetricsByCategory(category.slug, range);
      results.push(data);
    }

    return results;
  },

  async getSummary(range: DateRange = '30d'): Promise<{
    categories: CategoryWithMetrics[];
    dateRange: { from: string; to: string };
  }> {
    const categories = await this.getAllMetrics(range);
    const dateRange = getDateRange(range);

    return {
      categories,
      dateRange,
    };
  },

  // Admin functions for managing metrics
  async addMetricValue(
    metricId: number,
    count: number,
    weekOverWeekChange: number | null,
    percentile: number | null,
    recordedAt: Date = new Date()
  ): Promise<void> {
    await query(
      `INSERT INTO metric_values (metric_id, metric_count, week_over_week_change, percentile, recorded_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (metric_id, recorded_at)
       DO UPDATE SET metric_count = $2, week_over_week_change = $3, percentile = $4`,
      [metricId, count, weekOverWeekChange, percentile, recordedAt.toISOString().split('T')[0]]
    );

    // Invalidate cache
    cacheService.flush();
  },
};

export default metricsService;
