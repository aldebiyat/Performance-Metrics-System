# Technical Stack

This document provides a comprehensive overview of the technologies used in the Performance Metrics System.

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│    Frontend     │────▶│    Backend      │────▶│   PostgreSQL    │
│  React + Nginx  │     │  Express.js     │     │                 │
│                 │     │                 │     └─────────────────┘
└─────────────────┘     └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │                 │
                        │     Redis       │
                        │                 │
                        └─────────────────┘
```

## Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.3.1 | UI Framework |
| TypeScript | 4.9.5 | Type Safety |
| React Router DOM | 6.26.2 | Client-side Routing |
| Recharts | 3.6.0 | Data Visualization |
| Sentry | 10.32.1 | Error Tracking |
| Web Vitals | 2.1.4 | Performance Monitoring |

### Build & Development
- **React Scripts** 5.0.1 - Build tooling (Webpack-based)
- **Nginx** (Alpine) - Production static file server

### Testing
- **Jest** - Unit testing (via react-scripts)
- **React Testing Library** 16.0.1 - Component testing
- **User Event** 13.5.0 - User interaction simulation

### PWA Support
- Custom Service Worker for offline functionality
- Web App Manifest for installability

## Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 20 | Runtime Environment |
| Express.js | 4.21.1 | Web Framework |
| TypeScript | 5.6.2 | Type Safety |
| Zod | 4.2.1 | Schema Validation |
| Winston | 3.19.0 | Logging |

### Authentication & Security
| Technology | Version | Purpose |
|------------|---------|---------|
| jsonwebtoken | 9.0.2 | JWT Authentication |
| bcrypt | 5.1.1 | Password Hashing |
| Helmet | 8.1.0 | Security Headers |
| CORS | 2.8.5 | Cross-Origin Resource Sharing |
| express-rate-limit | 8.2.1 | API Rate Limiting |
| rate-limit-redis | 4.3.1 | Distributed Rate Limiting |

### API Documentation
| Technology | Version | Purpose |
|------------|---------|---------|
| swagger-jsdoc | 6.2.8 | OpenAPI Spec Generation |
| swagger-ui-express | 5.0.1 | Interactive API Docs |

### Data Processing & Export
| Technology | Version | Purpose |
|------------|---------|---------|
| PDFKit | 0.15.0 | PDF Generation |
| csv-parser | 3.0.0 | CSV Parsing |
| Multer | 2.0.2 | File Upload Handling |

### Email
| Technology | Version | Purpose |
|------------|---------|---------|
| Nodemailer | 7.0.12 | SMTP Email Sending |

### Development Tools
- **Nodemon** 3.1.7 - Auto-reload during development
- **ts-node** 10.9.2 - TypeScript execution
- **Jest** 30.2.0 - Testing framework
- **ts-jest** 29.4.6 - TypeScript Jest integration

## Database

| Technology | Version | Purpose |
|------------|---------|---------|
| PostgreSQL | 16 (Alpine) | Primary Database |
| pg | 8.11.3 | PostgreSQL Client |
| node-pg-migrate | 8.0.4 | Database Migrations |

### Database Configuration
- Connection pooling (20 max connections)
- 30s idle timeout
- 2s connection timeout

### Migrations
Located in `/backend/migrations/`:
1. `001_initial_schema.sql` - Base schema
2. `002_password_reset_tokens.sql` - Password reset
3. `003_email_verification.sql` - Email verification
4. `004_audit_logs.sql` - Audit logging
5. `005_organizations.sql` - Multi-tenant support

## Caching

| Technology | Version | Purpose |
|------------|---------|---------|
| Redis | 7 (Alpine) | Distributed Cache |
| redis (npm) | 5.10.0 | Node.js Redis Client |
| node-cache | 5.1.2 | In-memory Fallback Cache |

### Cache Strategy
- Primary: Redis for distributed caching
- Fallback: In-memory cache when Redis unavailable
- Default TTL: 300 seconds (configurable)

## Monitoring & Observability

| Technology | Version | Purpose |
|------------|---------|---------|
| prom-client | 15.1.3 | Prometheus Metrics |
| @sentry/node | 10.32.1 | Backend Error Tracking |
| @sentry/react | 10.32.1 | Frontend Error Tracking |
| Winston | 3.19.0 | Application Logging |
| Web Vitals | 2.1.4 | Frontend Performance |

### Logging
- Console transport (development)
- File transports (production):
  - `logs/error.log` - Error level
  - `logs/combined.log` - All levels

### Metrics Endpoint
- Prometheus-compatible metrics at `/metrics`
- Request duration histograms
- Request counters by status/method/path

## Containerization

| Technology | Version | Purpose |
|------------|---------|---------|
| Docker | - | Containerization |
| Docker Compose | - | Service Orchestration |

### Container Images
| Service | Base Image |
|---------|------------|
| Backend | node:20-alpine |
| Frontend | nginx:alpine (multi-stage from node:20-alpine) |
| Database | postgres:16-alpine |
| Cache | redis:7-alpine |

### Docker Compose Files
- `docker-compose.yml` - Development configuration
- `docker-compose.prod.yml` - Production overrides

### Security
- Non-root users in containers
- Multi-stage builds for smaller images
- Health checks for all services

## CI/CD

### GitHub Actions
Located in `.github/workflows/ci.yml`

| Job | Purpose |
|-----|---------|
| Security Scan | npm audit for vulnerabilities |
| CodeQL Analysis | Static code analysis |
| Test Backend | TypeScript build + Jest tests |
| Test Frontend | TypeScript build + Jest tests |
| Build | Docker image builds |

### Pipeline Flow
```
Security Scan ──┐
                ├──▶ Build
CodeQL ─────────┤
                │
Test Backend ───┤
                │
Test Frontend ──┘
```

## Security Features

### Headers (via Helmet & Nginx)
- X-Frame-Options: SAMEORIGIN
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin
- Content-Security-Policy

### Authentication
- JWT with access/refresh token pattern
- Bcrypt password hashing (12 salt rounds)
- Email verification tokens
- Password reset tokens
- Role-based access control

### Rate Limiting
- Configurable per endpoint type
- Redis-backed for distributed environments
- Separate limits for auth, API, and reset endpoints

## Performance Optimizations

### Frontend
- Gzip compression
- Static asset caching (1 year, immutable)
- Code splitting
- Service Worker caching

### Backend
- Response compression (threshold: 1KB)
- Database connection pooling
- Redis caching layer
- Query optimization

## Development Setup

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16 (or use Docker)
- Redis 7 (or use Docker)

### Quick Start
```bash
# Start all services
docker-compose up -d

# Backend development
cd backend
npm install
npm run dev

# Frontend development
cd frontend
npm install
npm start
```

### Environment Variables

#### Backend
| Variable | Description |
|----------|-------------|
| PORT | Server port (default: 5001) |
| NODE_ENV | Environment (development/production) |
| DB_HOST | PostgreSQL host |
| DB_PORT | PostgreSQL port |
| DB_NAME | Database name |
| DB_USER | Database user |
| DB_PASSWORD | Database password |
| JWT_SECRET | JWT signing secret |
| REDIS_URL | Redis connection URL |
| SENTRY_DSN | Sentry error tracking DSN |

#### Frontend
| Variable | Description |
|----------|-------------|
| REACT_APP_API_URL | Backend API URL |
| REACT_APP_SENTRY_DSN | Sentry error tracking DSN |

## Port Mapping

| Service | Port |
|---------|------|
| Frontend | 3000 |
| Backend | 5001 |
| PostgreSQL | 5432 |
| Redis | 6379 |

## Version Summary

| Component | Technology | Version |
|-----------|------------|---------|
| Frontend Framework | React | 18.3.1 |
| Backend Framework | Express.js | 4.21.1 |
| Language | TypeScript | 4.9.5 / 5.6.2 |
| Database | PostgreSQL | 16 |
| Cache | Redis | 7 |
| Runtime | Node.js | 20 |
| Web Server | Nginx | Alpine |
