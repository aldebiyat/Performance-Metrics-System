import { ApiResponse, AuthTokens } from '../types';

const API_URL = process.env.REACT_APP_API_URL;

if (!API_URL) {
  throw new Error('REACT_APP_API_URL environment variable is required');
}

// Token management - access token is kept in memory for security
let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

// Refresh token is now stored in httpOnly cookie, managed by the server
// These functions are kept for backward compatibility but are no-ops
export const getRefreshToken = (): string | null => {
  // Refresh token is now stored in httpOnly cookie
  // Return null as we can't access it from JavaScript (which is the security benefit)
  return null;
};

export const setRefreshToken = (_token: string | null) => {
  // No-op: refresh token is now stored in httpOnly cookie by the server
  // This function is kept for backward compatibility during transition
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
  // Refresh token is sent automatically via httpOnly cookie
  const response = await fetch(`${API_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // Include cookies in the request
  });

  if (!response.ok) {
    // Clear access token on refresh failure
    setAccessToken(null);
    throw new Error('Token refresh failed');
  }

  const data: ApiResponse<AuthTokens> = await response.json();
  if (data.success && data.data) {
    setAccessToken(data.data.accessToken);
    // Refresh token is set via httpOnly cookie by the server
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
    credentials: 'include', // Include cookies (for httpOnly refresh token)
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
          credentials: 'include', // Include cookies (for httpOnly refresh token)
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
              credentials: 'include', // Include cookies (for httpOnly refresh token)
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
    credentials: 'include', // Include cookies (for httpOnly refresh token)
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
