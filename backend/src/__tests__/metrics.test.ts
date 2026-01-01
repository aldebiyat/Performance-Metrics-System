import { AppError } from '../middleware/errorHandler';

// Mock database module
jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

// Mock cache service
jest.mock('../services/cacheService', () => ({
  cacheService: {
    getOrSet: jest.fn((key: string, fetchFn: () => Promise<unknown>) =>
      fetchFn().then((data: unknown) => ({ data, fromCache: false }))
    ),
    metricsKey: jest.fn((categorySlug: string, range: string) =>
      `metrics:${categorySlug}:${range}`
    ),
    flush: jest.fn().mockResolvedValue(undefined),
  },
}));

// Import after mocking
import { query } from '../config/database';
import { metricsService } from '../services/metricsService';

const mockQuery = query as jest.MockedFunction<typeof query>;

describe('Metrics Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCategories', () => {
    it('should return all categories', async () => {
      const mockCategories = [
        { id: 1, slug: 'acquisition', name: 'Acquisition', display_order: 1, created_at: new Date() },
        { id: 2, slug: 'activation', name: 'Activation', display_order: 2, created_at: new Date() },
        { id: 3, slug: 'retention', name: 'Retention', display_order: 3, created_at: new Date() },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockCategories } as never);

      const result = await metricsService.getCategories();

      expect(result).toEqual(mockCategories);
      expect(result.length).toBe(3);
    });

    it('should return empty array when no categories exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] } as never);

      const result = await metricsService.getCategories();

      expect(result).toEqual([]);
    });

    it('should return categories in display order', async () => {
      const mockCategories = [
        { id: 1, slug: 'first', name: 'First', display_order: 1, created_at: new Date() },
        { id: 2, slug: 'second', name: 'Second', display_order: 2, created_at: new Date() },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockCategories } as never);

      const result = await metricsService.getCategories();

      expect(result[0].display_order).toBeLessThan(result[1].display_order);
    });
  });

  describe('getMetricsByCategory', () => {
    it('should return metrics for a valid category', async () => {
      const categorySlug = 'acquisition';
      const mockCategory = { id: 1, slug: categorySlug, name: 'Acquisition' };
      const mockMetrics = [
        {
          id: 1,
          name: 'New Leads',
          slug: 'new-leads',
          description: 'Number of new leads',
          icon: 'users',
          count: 150,
          weekOverWeekChange: 12.5,
          percentile: 85,
          recordedAt: new Date(),
        },
        {
          id: 2,
          name: 'Website Visits',
          slug: 'website-visits',
          description: 'Total website visits',
          icon: 'globe',
          count: 5000,
          weekOverWeekChange: -3.2,
          percentile: 72,
          recordedAt: new Date(),
        },
      ];

      // Mock category query
      mockQuery.mockResolvedValueOnce({ rows: [mockCategory] } as never);
      // Mock metrics query
      mockQuery.mockResolvedValueOnce({ rows: mockMetrics } as never);

      const result = await metricsService.getMetricsByCategory(categorySlug, '30d');

      expect(result.category.slug).toBe(categorySlug);
      expect(result.metrics.length).toBe(2);
      expect(result.dateRange).toBeDefined();
      expect(result.dateRange.from).toBeDefined();
      expect(result.dateRange.to).toBeDefined();
    });

    it('should throw not found error for invalid category', async () => {
      const categorySlug = 'nonexistent';

      // Mock category query - no results
      mockQuery.mockResolvedValueOnce({ rows: [] } as never);

      try {
        await metricsService.getMetricsByCategory(categorySlug);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(404);
        expect((error as AppError).message).toBe(`Category '${categorySlug}' not found`);
      }
    });

    it('should handle category with no metrics', async () => {
      const categorySlug = 'empty-category';
      const mockCategory = { id: 99, slug: categorySlug, name: 'Empty Category' };

      mockQuery.mockResolvedValueOnce({ rows: [mockCategory] } as never);
      mockQuery.mockResolvedValueOnce({ rows: [] } as never);

      const result = await metricsService.getMetricsByCategory(categorySlug);

      expect(result.category.slug).toBe(categorySlug);
      expect(result.metrics).toEqual([]);
    });

    it('should use default range when not specified', async () => {
      const categorySlug = 'acquisition';
      const mockCategory = { id: 1, slug: categorySlug, name: 'Acquisition' };

      mockQuery.mockResolvedValueOnce({ rows: [mockCategory] } as never);
      mockQuery.mockResolvedValueOnce({ rows: [] } as never);

      const result = await metricsService.getMetricsByCategory(categorySlug);

      // Default is 30d
      expect(result.dateRange).toBeDefined();
    });

    it('should handle metrics with null values', async () => {
      const categorySlug = 'acquisition';
      const mockCategory = { id: 1, slug: categorySlug, name: 'Acquisition' };
      const mockMetrics = [
        {
          id: 1,
          name: 'New Leads',
          slug: 'new-leads',
          description: null,
          icon: null,
          count: null,
          weekOverWeekChange: null,
          percentile: null,
          recordedAt: null,
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: [mockCategory] } as never);
      mockQuery.mockResolvedValueOnce({ rows: mockMetrics } as never);

      const result = await metricsService.getMetricsByCategory(categorySlug);

      expect(result.metrics[0].count).toBe(0); // null count should become 0
      expect(result.metrics[0].weekOverWeekChange).toBeNull();
      expect(result.metrics[0].recordedAt).toBeNull();
    });
  });

  describe('date range calculation', () => {
    it('should calculate 7d range correctly', async () => {
      const categorySlug = 'acquisition';
      const mockCategory = { id: 1, slug: categorySlug, name: 'Acquisition' };

      mockQuery.mockResolvedValueOnce({ rows: [mockCategory] } as never);
      mockQuery.mockResolvedValueOnce({ rows: [] } as never);

      const result = await metricsService.getMetricsByCategory(categorySlug, '7d');

      const from = new Date(result.dateRange.from);
      const to = new Date(result.dateRange.to);
      const diffDays = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));

      expect(diffDays).toBeGreaterThanOrEqual(6);
      expect(diffDays).toBeLessThanOrEqual(7);
    });

    it('should calculate 30d range correctly', async () => {
      const categorySlug = 'acquisition';
      const mockCategory = { id: 1, slug: categorySlug, name: 'Acquisition' };

      mockQuery.mockResolvedValueOnce({ rows: [mockCategory] } as never);
      mockQuery.mockResolvedValueOnce({ rows: [] } as never);

      const result = await metricsService.getMetricsByCategory(categorySlug, '30d');

      const from = new Date(result.dateRange.from);
      const to = new Date(result.dateRange.to);
      const diffDays = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));

      expect(diffDays).toBeGreaterThanOrEqual(29);
      expect(diffDays).toBeLessThanOrEqual(30);
    });

    it('should calculate 90d range correctly', async () => {
      const categorySlug = 'acquisition';
      const mockCategory = { id: 1, slug: categorySlug, name: 'Acquisition' };

      mockQuery.mockResolvedValueOnce({ rows: [mockCategory] } as never);
      mockQuery.mockResolvedValueOnce({ rows: [] } as never);

      const result = await metricsService.getMetricsByCategory(categorySlug, '90d');

      const from = new Date(result.dateRange.from);
      const to = new Date(result.dateRange.to);
      const diffDays = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));

      expect(diffDays).toBeGreaterThanOrEqual(89);
      expect(diffDays).toBeLessThanOrEqual(90);
    });

    it('should calculate 1y range correctly', async () => {
      const categorySlug = 'acquisition';
      const mockCategory = { id: 1, slug: categorySlug, name: 'Acquisition' };

      mockQuery.mockResolvedValueOnce({ rows: [mockCategory] } as never);
      mockQuery.mockResolvedValueOnce({ rows: [] } as never);

      const result = await metricsService.getMetricsByCategory(categorySlug, '1y');

      const from = new Date(result.dateRange.from);
      const to = new Date(result.dateRange.to);
      const diffDays = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));

      // 1 year is approximately 365 days (can vary by 1-2 days due to leap years)
      expect(diffDays).toBeGreaterThanOrEqual(364);
      expect(diffDays).toBeLessThanOrEqual(366);
    });
  });

  describe('getAllMetrics', () => {
    it('should return metrics for all categories', async () => {
      const mockCategories = [
        { id: 1, slug: 'acquisition', name: 'Acquisition', display_order: 1, created_at: new Date() },
        { id: 2, slug: 'activation', name: 'Activation', display_order: 2, created_at: new Date() },
      ];

      const mockCategoryData1 = { id: 1, slug: 'acquisition', name: 'Acquisition' };
      const mockCategoryData2 = { id: 2, slug: 'activation', name: 'Activation' };

      const mockMetrics1 = [
        { id: 1, name: 'Leads', slug: 'leads', description: null, icon: null, count: 100, weekOverWeekChange: 5, percentile: 80, recordedAt: new Date() },
      ];
      const mockMetrics2 = [
        { id: 2, name: 'Signups', slug: 'signups', description: null, icon: null, count: 50, weekOverWeekChange: 10, percentile: 90, recordedAt: new Date() },
      ];

      // getCategories call
      mockQuery.mockResolvedValueOnce({ rows: mockCategories } as never);
      // getMetricsByCategory for acquisition
      mockQuery.mockResolvedValueOnce({ rows: [mockCategoryData1] } as never);
      mockQuery.mockResolvedValueOnce({ rows: mockMetrics1 } as never);
      // getMetricsByCategory for activation
      mockQuery.mockResolvedValueOnce({ rows: [mockCategoryData2] } as never);
      mockQuery.mockResolvedValueOnce({ rows: mockMetrics2 } as never);

      const result = await metricsService.getAllMetrics('30d');

      expect(result.length).toBe(2);
      expect(result[0].category.slug).toBe('acquisition');
      expect(result[1].category.slug).toBe('activation');
    });
  });

  describe('getSummary', () => {
    it('should return summary with all categories and date range', async () => {
      const mockCategories = [
        { id: 1, slug: 'acquisition', name: 'Acquisition', display_order: 1, created_at: new Date() },
      ];

      const mockCategoryData = { id: 1, slug: 'acquisition', name: 'Acquisition' };
      const mockMetrics: never[] = [];

      mockQuery.mockResolvedValueOnce({ rows: mockCategories } as never);
      mockQuery.mockResolvedValueOnce({ rows: [mockCategoryData] } as never);
      mockQuery.mockResolvedValueOnce({ rows: mockMetrics } as never);

      const result = await metricsService.getSummary('30d');

      expect(result.categories).toBeDefined();
      expect(result.dateRange).toBeDefined();
      expect(result.dateRange.from).toBeDefined();
      expect(result.dateRange.to).toBeDefined();
    });
  });

  describe('addMetricValue', () => {
    it('should add a new metric value', async () => {
      const metricId = 1;
      const count = 100;
      const weekOverWeekChange = 5.5;
      const percentile = 85;

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

      await expect(
        metricsService.addMetricValue(metricId, count, weekOverWeekChange, percentile)
      ).resolves.not.toThrow();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO metric_values'),
        expect.arrayContaining([metricId, count, weekOverWeekChange, percentile])
      );
    });

    it('should handle null optional values', async () => {
      const metricId = 1;
      const count = 100;

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

      await expect(
        metricsService.addMetricValue(metricId, count, null, null)
      ).resolves.not.toThrow();
    });

    it('should use upsert to update existing values', async () => {
      const metricId = 1;
      const count = 200;
      const weekOverWeekChange = 10;
      const percentile = 90;

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

      await metricsService.addMetricValue(metricId, count, weekOverWeekChange, percentile);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        expect.any(Array)
      );
    });
  });
});
