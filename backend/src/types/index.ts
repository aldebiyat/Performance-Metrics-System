export interface User {
  id: number;
  email: string;
  password_hash: string;
  name: string | null;
  role: 'admin' | 'editor' | 'viewer';
  is_active: boolean;
  email_verified: boolean;
  verification_token?: string | null;
  verification_token_expires?: Date | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Category {
  id: number;
  slug: string;
  name: string;
  display_order: number;
  created_at: Date;
}

export interface MetricDefinition {
  id: number;
  category_id: number;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  display_order: number;
  is_active: boolean;
  created_at: Date;
}

export interface MetricValue {
  id: number;
  metric_id: number;
  metric_count: number;
  week_over_week_change: number | null;
  percentile: number | null;
  recorded_at: Date;
  created_at: Date;
}

export interface RefreshToken {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
}

// API Response types
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

export interface MetricWithValue {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  count: number;
  weekOverWeekChange: number | null;
  percentile: number | null;
  recordedAt: string;
}

export interface CategoryWithMetrics {
  category: {
    id: number;
    slug: string;
    name: string;
  };
  metrics: MetricWithValue[];
  dateRange: {
    from: string;
    to: string;
  };
}

export interface TokenPayload {
  userId: number;
  email: string;
  role: string;
  iat?: number; // Issued at timestamp (added by JWT)
  exp?: number; // Expiration timestamp (added by JWT)
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export type DateRange = '7d' | '30d' | '90d' | '1y';

// Extend Express Request type for requestId and organization context
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      organizationId?: number;
      organizationRole?: string;
    }
  }
}
