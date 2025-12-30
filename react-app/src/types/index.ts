export interface User {
  id: number;
  email: string;
  name: string | null;
  role: 'admin' | 'editor' | 'viewer';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface Category {
  id: number;
  slug: string;
  name: string;
  display_order: number;
}

export interface Metric {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  count: number;
  weekOverWeekChange: number | null;
  percentile: number | null;
  recordedAt: string | null;
}

export interface CategoryWithMetrics {
  category: {
    id: number;
    slug: string;
    name: string;
  };
  metrics: Metric[];
  dateRange: {
    from: string;
    to: string;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    cached?: boolean;
    cachedAt?: string;
  };
}

export type DateRange = '7d' | '30d' | '90d' | '1y';

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
}
