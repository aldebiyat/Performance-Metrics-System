import { renderHook, waitFor, act } from '@testing-library/react';
import { useMetrics } from '../useMetrics';

// Mock the API client
jest.mock('../../api/client', () => ({
  api: {
    get: jest.fn(),
  },
}));

import { api } from '../../api/client';
const mockApi = api as jest.Mocked<typeof api>;

describe('useMetrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should stop polling after MAX_RETRIES consecutive errors', async () => {
    mockApi.get.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      useMetrics({ category: 'performance', pollingInterval: 1000, maxRetries: 3 })
    );

    // Wait for initial fetch
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.error).toBe('Network error');

    // Trigger retries by advancing time - exponential backoff: 2000, 4000, 8000
    // First retry at 2000ms (1000 * 2^1)
    await act(async () => {
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    // Second retry at 4000ms (1000 * 2^2)
    await act(async () => {
      jest.advanceTimersByTime(4000);
      await Promise.resolve();
    });

    // Third retry at 8000ms (1000 * 2^3)
    await act(async () => {
      jest.advanceTimersByTime(8000);
      await Promise.resolve();
    });

    // Should be paused after 3 consecutive errors (initial + 3 retries = 4 calls, then pause)
    // But the check happens at the start of scheduleNextPoll, so after 3 errors (initial + 2 retries), it pauses
    await waitFor(() => {
      expect(result.current.isPollingPaused).toBe(true);
    });

    // Verify no more calls after pausing
    const callCountWhenPaused = mockApi.get.mock.calls.length;

    await act(async () => {
      jest.advanceTimersByTime(20000);
      await Promise.resolve();
    });

    expect(mockApi.get.mock.calls.length).toBe(callCountWhenPaused);
  });

  it('should reset error count on successful fetch', async () => {
    mockApi.get
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        success: true,
        data: { category: { id: 1, name: 'Performance' }, metrics: [] },
      });

    const { result } = renderHook(() =>
      useMetrics({ category: 'performance', pollingInterval: 1000 })
    );

    // Wait for initial fetch (which fails)
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.error).toBe('Network error');

    // Advance time for first retry (backoff: 1000 * 2^1 = 2000ms)
    await act(async () => {
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
      expect(result.current.isPollingPaused).toBe(false);
    });
  });

  it('should apply exponential backoff on errors', async () => {
    mockApi.get.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      useMetrics({ category: 'performance', pollingInterval: 1000, maxRetries: 5 })
    );

    // Wait for initial fetch
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockApi.get).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBe('Network error');

    // After first error (consecutiveErrors = 1), backoff is 1000 * 2^1 = 2000ms
    // At 1500ms, should not have triggered the second poll yet
    await act(async () => {
      jest.advanceTimersByTime(1500);
      await Promise.resolve();
    });
    // Still 1 call - the backoff timer hasn't fired yet
    expect(mockApi.get).toHaveBeenCalledTimes(1);

    // At 2000ms total, should trigger second call
    await act(async () => {
      jest.advanceTimersByTime(500);
      await Promise.resolve();
    });
    expect(mockApi.get).toHaveBeenCalledTimes(2);

    // After second error (consecutiveErrors = 2), backoff is 1000 * 2^2 = 4000ms
    // At 3500ms more, should not have made another call
    await act(async () => {
      jest.advanceTimersByTime(3500);
      await Promise.resolve();
    });
    expect(mockApi.get).toHaveBeenCalledTimes(2);

    // At 4000ms total since last call, should trigger third call
    await act(async () => {
      jest.advanceTimersByTime(500);
      await Promise.resolve();
    });
    expect(mockApi.get).toHaveBeenCalledTimes(3);
  });

  it('should allow resuming polling after it was paused', async () => {
    mockApi.get
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        success: true,
        data: { category: { id: 1, name: 'Performance' }, metrics: [] },
      });

    const { result } = renderHook(() =>
      useMetrics({ category: 'performance', pollingInterval: 1000, maxRetries: 3 })
    );

    // Wait for initial fetch
    await act(async () => {
      await Promise.resolve();
    });

    // Trigger retries until paused
    await act(async () => {
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(4000);
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(8000);
      await Promise.resolve();
    });

    // Wait for polling to pause
    await waitFor(() => {
      expect(result.current.isPollingPaused).toBe(true);
    });

    // Resume polling
    await act(async () => {
      result.current.resumePolling();
    });

    expect(result.current.isPollingPaused).toBe(false);
  });

  it('should respect custom maxRetries option', async () => {
    mockApi.get.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      useMetrics({ category: 'performance', pollingInterval: 1000, maxRetries: 2 })
    );

    // Wait for initial fetch
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.error).toBe('Network error');

    // First retry at 2000ms
    await act(async () => {
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    // Second retry at 4000ms - this should be the last
    await act(async () => {
      jest.advanceTimersByTime(4000);
      await Promise.resolve();
    });

    // Should be paused after maxRetries (2) consecutive errors
    await waitFor(() => {
      expect(result.current.isPollingPaused).toBe(true);
    });

    // Should have made at most 3 calls (initial + 2 retries)
    expect(mockApi.get.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it('should fetch data successfully on initial load', async () => {
    const mockData = {
      category: { id: 1, name: 'Performance' },
      metrics: [{ id: 1, name: 'CPU Usage', value: 75 }],
    };

    mockApi.get.mockResolvedValue({
      success: true,
      data: mockData,
    });

    const { result } = renderHook(() =>
      useMetrics({ category: 'performance', pollingInterval: 0 })
    );

    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
    expect(result.current.isPollingPaused).toBe(false);
  });
});
