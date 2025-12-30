import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client';
import { CategoryWithMetrics, DateRange, ApiResponse } from '../types';

interface UseMetricsOptions {
  category: string;
  range?: DateRange;
  pollingInterval?: number; // in milliseconds, 0 to disable
}

interface UseMetricsReturn {
  data: CategoryWithMetrics | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  lastUpdated: Date | null;
}

export const useMetrics = ({
  category,
  range = '30d',
  pollingInterval = 30000, // 30 seconds default
}: UseMetricsOptions): UseMetricsReturn => {
  const [data, setData] = useState<CategoryWithMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const isVisibleRef = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response: ApiResponse<CategoryWithMetrics> = await api.get(
        `/api/metrics/${category}?range=${range}`
      );

      if (response.success && response.data) {
        setData(response.data);
        setLastUpdated(new Date());
      } else {
        setError(response.error?.message || 'Failed to fetch metrics');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [category, range]);

  // Initial fetch
  useEffect(() => {
    setIsLoading(true);
    fetchData();
  }, [fetchData]);

  // Polling logic
  useEffect(() => {
    if (pollingInterval <= 0) return;

    const startPolling = () => {
      pollingRef.current = setInterval(() => {
        if (isVisibleRef.current) {
          fetchData();
        }
      }, pollingInterval);
    };

    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;

      if (document.hidden) {
        // Stop polling when tab is hidden
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      } else {
        // Resume polling and fetch immediately when tab becomes visible
        fetchData();
        startPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchData, pollingInterval]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
    lastUpdated,
  };
};

// Hook for fetching all metrics summary
export const useMetricsSummary = (range: DateRange = '30d', pollingInterval = 30000) => {
  const [data, setData] = useState<CategoryWithMetrics[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response: ApiResponse<{ categories: CategoryWithMetrics[] }> = await api.get(
        `/api/metrics/summary?range=${range}`
      );

      if (response.success && response.data) {
        setData(response.data.categories);
        setLastUpdated(new Date());
      } else {
        setError(response.error?.message || 'Failed to fetch metrics');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [range]);

  useEffect(() => {
    setIsLoading(true);
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (pollingInterval <= 0) return;

    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchData();
      }
    }, pollingInterval);

    return () => clearInterval(interval);
  }, [fetchData, pollingInterval]);

  return { data, isLoading, error, refetch: fetchData, lastUpdated };
};

export default useMetrics;
