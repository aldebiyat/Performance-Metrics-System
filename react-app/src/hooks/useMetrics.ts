import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client';
import { CategoryWithMetrics, DateRange, ApiResponse } from '../types';

interface UseMetricsOptions {
  category: string;
  range?: DateRange;
  pollingInterval?: number; // in milliseconds, 0 to disable
  maxRetries?: number; // max consecutive errors before pausing polling
}

interface UseMetricsReturn {
  data: CategoryWithMetrics | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<boolean>;
  lastUpdated: Date | null;
  isPollingPaused: boolean;
  resumePolling: () => void;
}

export const useMetrics = ({
  category,
  range = '30d',
  pollingInterval = 30000, // 30 seconds default
  maxRetries = 3, // default max consecutive errors before pausing
}: UseMetricsOptions): UseMetricsReturn => {
  const [data, setData] = useState<CategoryWithMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isPollingPaused, setIsPollingPaused] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isVisibleRef = useRef(true);
  const consecutiveErrorsRef = useRef(0);
  const currentBackoffRef = useRef(pollingInterval);

  const fetchData = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      const response: ApiResponse<CategoryWithMetrics> = await api.get(
        `/api/metrics/${category}?range=${range}`
      );

      if (response.success && response.data) {
        setData(response.data);
        setLastUpdated(new Date());
        // Reset error count on success
        consecutiveErrorsRef.current = 0;
        currentBackoffRef.current = pollingInterval;
        return true;
      } else {
        setError(response.error?.message || 'Failed to fetch metrics');
        consecutiveErrorsRef.current += 1;
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      consecutiveErrorsRef.current += 1;
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [category, range, pollingInterval]);

  // Schedule next poll with exponential backoff
  const scheduleNextPoll = useCallback(() => {
    if (pollingInterval <= 0 || isPollingPaused) return;

    // Check if we've exceeded max retries
    if (consecutiveErrorsRef.current >= maxRetries) {
      setIsPollingPaused(true);
      return;
    }

    // Apply exponential backoff on errors
    const delay = consecutiveErrorsRef.current > 0
      ? pollingInterval * Math.pow(2, consecutiveErrorsRef.current)
      : pollingInterval;

    currentBackoffRef.current = delay;

    pollingRef.current = setTimeout(async () => {
      if (isVisibleRef.current && !isPollingPaused) {
        await fetchData();
        scheduleNextPoll();
      }
    }, delay);
  }, [fetchData, pollingInterval, maxRetries, isPollingPaused]);

  // Resume polling function
  const resumePolling = useCallback(() => {
    consecutiveErrorsRef.current = 0;
    currentBackoffRef.current = pollingInterval;
    setIsPollingPaused(false);
  }, [pollingInterval]);

  // Initial fetch and start polling
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      setIsLoading(true);
      await fetchData();
      // Only schedule next poll if component is still mounted and polling is enabled
      if (isMounted && pollingInterval > 0 && !isPollingPaused) {
        scheduleNextPoll();
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, [fetchData, pollingInterval, scheduleNextPoll, isPollingPaused]);

  // Visibility change handler
  useEffect(() => {
    if (pollingInterval <= 0) return;

    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;

      if (document.hidden) {
        // Stop polling when tab is hidden
        if (pollingRef.current) {
          clearTimeout(pollingRef.current);
          pollingRef.current = null;
        }
      } else if (!isPollingPaused) {
        // Resume polling and fetch immediately when tab becomes visible
        fetchData().then(() => {
          if (!isPollingPaused) {
            scheduleNextPoll();
          }
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchData, pollingInterval, scheduleNextPoll, isPollingPaused]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
    lastUpdated,
    isPollingPaused,
    resumePolling,
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
