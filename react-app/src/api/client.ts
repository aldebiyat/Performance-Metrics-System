import { ApiResponse, AuthTokens } from '../types';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

// Token management
let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

export const getRefreshToken = (): string | null => {
  return localStorage.getItem('refreshToken');
};

export const setRefreshToken = (token: string | null) => {
  if (token) {
    localStorage.setItem('refreshToken', token);
  } else {
    localStorage.removeItem('refreshToken');
  }
};

// Refresh token logic
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const subscribeTokenRefresh = (cb: (token: string) => void) => {
  refreshSubscribers.push(cb);
};

const onTokenRefreshed = (token: string) => {
  refreshSubscribers.forEach(cb => cb(token));
  refreshSubscribers = [];
};

const refreshAccessToken = async (): Promise<string> => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  const response = await fetch(`${API_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    // Clear tokens on refresh failure
    setAccessToken(null);
    setRefreshToken(null);
    throw new Error('Token refresh failed');
  }

  const data: ApiResponse<AuthTokens> = await response.json();
  if (data.success && data.data) {
    setAccessToken(data.data.accessToken);
    setRefreshToken(data.data.refreshToken);
    return data.data.accessToken;
  }

  throw new Error('Token refresh failed');
};

// API client
interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  requireAuth?: boolean;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { method = 'GET', body, headers = {}, requireAuth = true } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (requireAuth && accessToken) {
    requestHeaders['Authorization'] = `Bearer ${accessToken}`;
  }

  let response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Handle 401 - try to refresh token
  if (response.status === 401 && requireAuth) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const newToken = await refreshAccessToken();
        isRefreshing = false;
        onTokenRefreshed(newToken);

        // Retry original request
        requestHeaders['Authorization'] = `Bearer ${newToken}`;
        response = await fetch(`${API_URL}${endpoint}`, {
          method,
          headers: requestHeaders,
          body: body ? JSON.stringify(body) : undefined,
        });
      } catch (error) {
        isRefreshing = false;
        // Redirect to login or handle auth failure
        window.dispatchEvent(new CustomEvent('auth:logout'));
        throw error;
      }
    } else {
      // Wait for token refresh
      return new Promise((resolve, reject) => {
        subscribeTokenRefresh(async (token) => {
          try {
            requestHeaders['Authorization'] = `Bearer ${token}`;
            const retryResponse = await fetch(`${API_URL}${endpoint}`, {
              method,
              headers: requestHeaders,
              body: body ? JSON.stringify(body) : undefined,
            });
            const data = await retryResponse.json();
            resolve(data);
          } catch (error) {
            reject(error);
          }
        });
      });
    }
  }

  return response.json();
}

// Convenience methods
export const api = {
  get: <T>(endpoint: string, requireAuth = true) =>
    apiRequest<T>(endpoint, { method: 'GET', requireAuth }),

  post: <T>(endpoint: string, body: any, requireAuth = true) =>
    apiRequest<T>(endpoint, { method: 'POST', body, requireAuth }),

  put: <T>(endpoint: string, body: any, requireAuth = true) =>
    apiRequest<T>(endpoint, { method: 'PUT', body, requireAuth }),

  delete: <T>(endpoint: string, requireAuth = true) =>
    apiRequest<T>(endpoint, { method: 'DELETE', requireAuth }),
};

// Export download helper
export const downloadFile = async (
  endpoint: string,
  filename: string
): Promise<void> => {
  const requestHeaders: Record<string, string> = {};

  if (accessToken) {
    requestHeaders['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'GET',
    headers: requestHeaders,
  });

  if (!response.ok) {
    throw new Error('Download failed');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

export default api;
