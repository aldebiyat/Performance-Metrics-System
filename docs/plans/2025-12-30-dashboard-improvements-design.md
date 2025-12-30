# Performance Metrics Dashboard - Improvement Design

**Date:** 2025-12-30
**Status:** Approved

## Overview

Comprehensive upgrade of the Performance Metrics System from a CSV-based prototype to a production-ready application with PostgreSQL, authentication, and modern UX features.

## Decisions Made

| Decision | Choice |
|----------|--------|
| Database | PostgreSQL |
| Authentication | JWT + Local Auth |
| Real-time Updates | Polling (30s) |
| Data Export | CSV + PDF |
| Date Filtering | Preset Ranges (7d, 30d, 90d, 1y) |

## Database Schema

### Tables

```sql
-- Categories as separate table for easy management
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Metric definitions (what metrics exist)
CREATE TABLE metric_definitions (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    slug VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(category_id, slug)
);

-- Metric values over time (the actual data)
CREATE TABLE metric_values (
    id SERIAL PRIMARY KEY,
    metric_id INTEGER REFERENCES metric_definitions(id) ON DELETE CASCADE,
    metric_count INTEGER NOT NULL,
    week_over_week_change DECIMAL(5,2),
    percentile INTEGER CHECK (percentile >= 0 AND percentile <= 100),
    recorded_at DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(metric_id, recorded_at)
);

-- Users with soft delete
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'viewer',
    is_active BOOLEAN DEFAULT true,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Refresh tokens for secure JWT rotation
CREATE TABLE refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes

```sql
CREATE INDEX idx_metric_values_metric_date ON metric_values(metric_id, recorded_at DESC);
CREATE INDEX idx_metric_values_recorded_at ON metric_values(recorded_at DESC);
CREATE INDEX idx_metric_definitions_category ON metric_definitions(category_id);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
```

## API Design

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Returns access token (15min) + refresh token (7d)
- `POST /api/auth/refresh` - Exchange refresh token for new access token
- `POST /api/auth/logout` - Invalidate refresh token

### Metrics (Protected)
- `GET /api/metrics/categories` - List all categories
- `GET /api/metrics/:category?range=30d` - Get metrics by category
- `GET /api/metrics/summary?range=30d` - All categories aggregated

### Export (Protected)
- `GET /api/export/csv?category=overview&range=30d` - Download CSV
- `GET /api/export/pdf?category=all&range=30d` - Download PDF report

## Frontend Architecture

### New Structure
```
react-app/src/
├── api/client.ts              # Axios instance with interceptors
├── context/AuthContext.tsx    # User state, token management
├── hooks/
│   ├── useAuth.ts
│   ├── useMetrics.ts          # Fetch with polling
│   └── useExport.ts
├── components/
│   ├── DateRangeFilter.tsx
│   ├── ExportButton.tsx
│   ├── LoadingSpinner.tsx
│   ├── ErrorBanner.tsx
│   └── ProtectedRoute.tsx
├── pages/
│   ├── Login.tsx
│   └── Register.tsx
└── types/index.ts
```

### Key Features
- Environment-based API URL configuration
- Axios interceptors for automatic token refresh
- 30-second polling when tab is active
- Loading skeletons and error banners
- Protected routes with redirect to login
