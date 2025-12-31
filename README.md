# Performance Metrics Dashboard

A production-ready, full-stack application for tracking and analyzing website performance metrics. Built with React, Express.js, TypeScript, PostgreSQL, and Redis.

## Features

### Core Features
- **Metrics Dashboard**: View performance metrics across Overview, Traffic, and Site Performance categories
- **Interactive Charts**: Visual representation of metrics with week-over-week change indicators
- **Date Range Filtering**: Filter metrics by 7d, 30d, 90d, or 1 year
- **Export Functionality**: Export metrics data as CSV or PDF
- **Real-time Polling**: Auto-refresh metrics data every 30 seconds

### Security & Infrastructure
- **JWT Authentication**: Secure authentication with access/refresh token rotation
- **Rate Limiting**: Protection against brute force attacks (Redis-backed for distributed deployments)
- **Input Validation**: Zod schema validation on all API endpoints
- **Security Headers**: Helmet.js for comprehensive HTTP security headers
- **CORS Protection**: Configurable cross-origin resource sharing

### Professional Features
- **API Documentation**: Interactive Swagger/OpenAPI documentation
- **Password Reset**: Email-based password reset flow
- **Email Verification**: Email verification on user registration
- **Distributed Caching**: Redis caching with memory fallback
- **Error Tracking**: Sentry integration for error monitoring
- **Structured Logging**: Winston logging with request correlation
- **Compression**: Gzip compression for API responses

### Admin Features
- **Admin Dashboard**: User management with role-based access
- **Data Import**: CSV upload with validation and preview
- **Audit Logging**: Track all user actions for security compliance
- **Multi-tenancy**: Organization support with member management

### User Experience
- **Dark Mode**: System preference detection with manual toggle
- **PWA Support**: Offline-capable Progressive Web App
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 18, TypeScript, React Router |
| Backend | Express.js, TypeScript, Node.js 20 |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Authentication | JWT (access + refresh tokens) |
| Validation | Zod |
| Documentation | Swagger/OpenAPI |
| Logging | Winston |
| Error Tracking | Sentry |
| Containerization | Docker, Docker Compose |
| CI/CD | GitHub Actions |

## Quick Start

### Prerequisites

- Node.js 20.x or later
- PostgreSQL 16
- Redis 7 (optional, falls back to memory cache)
- Docker & Docker Compose (for containerized deployment)

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd Performance-Metrics-System

# Start all services (PostgreSQL, Redis, Backend, Frontend)
docker compose up

# For production
docker compose -f docker-compose.yml -f docker-compose.prod.yml up
```

### Option 2: Manual Setup

#### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd Performance-Metrics-System

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../react-app
npm install
```

#### 2. Configure Environment Variables

**Backend** (`backend/.env`):
```env
# Server
PORT=5001
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=performance_metrics
DB_USER=postgres
DB_PASSWORD=postgres
DATABASE_URL=postgres://postgres:postgres@localhost:5432/performance_metrics

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Redis (optional)
REDIS_URL=redis://localhost:6379

# CORS
CORS_ORIGIN=http://localhost:3000

# Email (for password reset and verification)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourapp.com
FRONTEND_URL=http://localhost:3000

# Error Tracking (optional)
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project

# Logging
LOG_LEVEL=info
```

**Frontend** (`react-app/.env`):
```env
REACT_APP_API_URL=http://localhost:5001
REACT_APP_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project
```

#### 3. Setup Database

```bash
# Create the database
createdb performance_metrics

# Run migrations
cd backend
npm run migrate:up

# Seed initial data (optional)
npm run seed
```

#### 4. Start the Application

```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start frontend
cd react-app
npm start
```

## Key URLs

| URL | Description |
|-----|-------------|
| http://localhost:3000 | Frontend application |
| http://localhost:5001 | Backend API |
| http://localhost:5001/api/docs | Swagger API documentation |
| http://localhost:3000/admin | Admin dashboard |
| http://localhost:3000/admin/users | User management |
| http://localhost:3000/admin/audit-log | Audit log viewer |
| http://localhost:3000/admin/import | Data import |
| http://localhost:3000/settings/organization | Organization settings |

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/auth/verify-email` | Verify email |
| POST | `/api/auth/resend-verification` | Resend verification email |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password |

### Metrics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/metrics/categories` | Get all categories |
| GET | `/api/metrics/summary` | Get metrics summary |
| GET | `/api/metrics/:category` | Get metrics by category |

### Export
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/export/csv` | Export as CSV |
| GET | `/api/export/pdf` | Export as PDF |

### Admin (requires admin role)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/stats` | Dashboard statistics |
| GET | `/api/admin/users` | List all users |
| GET | `/api/admin/users/:id` | Get user by ID |
| PUT | `/api/admin/users/:id` | Update user |
| DELETE | `/api/admin/users/:id` | Delete user |
| GET | `/api/admin/audit-logs` | Get audit logs |

### Data Import (requires admin role)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/import/csv` | Import CSV data |
| GET | `/api/import/template` | Download CSV template |

### Organizations
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/organizations` | Create organization |
| GET | `/api/organizations` | List user's organizations |
| GET | `/api/organizations/:id` | Get organization |
| PUT | `/api/organizations/:id` | Update organization |
| DELETE | `/api/organizations/:id` | Delete organization |
| POST | `/api/organizations/:id/members` | Add member |
| DELETE | `/api/organizations/:id/members/:userId` | Remove member |
| PUT | `/api/organizations/:id/members/:userId` | Update member role |
| POST | `/api/organizations/:id/switch` | Switch organization |

## Available Scripts

### Backend

```bash
cd backend

npm run dev          # Start development server with hot reload
npm run build        # Build TypeScript to JavaScript
npm start            # Start production server
npm test             # Run tests

npm run migrate:up   # Run pending migrations
npm run migrate:down # Rollback last migration
npm run migrate:create -- <name>  # Create new migration
```

### Frontend

```bash
cd react-app

npm start            # Start development server
npm run build        # Build for production
npm test             # Run tests
npm run test:coverage # Run tests with coverage
```

### Docker

```bash
# Development
docker compose up                    # Start all services
docker compose up -d                 # Start in background
docker compose down                  # Stop all services
docker compose logs -f               # View logs

# Production
docker compose -f docker-compose.yml -f docker-compose.prod.yml up

# Build images
docker compose build
```

## Project Structure

```
Performance-Metrics-System/
├── backend/
│   ├── src/
│   │   ├── config/         # Database, Redis, Logger, Swagger config
│   │   ├── middleware/     # Auth, Rate limiting, Error handling
│   │   ├── routes/         # API route handlers
│   │   ├── services/       # Business logic
│   │   ├── types/          # TypeScript interfaces
│   │   ├── validators/     # Zod validation schemas
│   │   └── index.ts        # Application entry point
│   ├── migrations/         # Database migrations
│   ├── package.json
│   └── tsconfig.json
├── react-app/
│   ├── public/
│   ├── src/
│   │   ├── api/            # API client
│   │   ├── components/     # Reusable components
│   │   ├── context/        # React contexts (Auth, Theme)
│   │   ├── hooks/          # Custom hooks
│   │   ├── pages/          # Page components
│   │   │   └── admin/      # Admin pages
│   │   ├── styles/         # Global styles
│   │   └── types/          # TypeScript interfaces
│   └── package.json
├── .github/
│   └── workflows/          # GitHub Actions CI/CD
├── docker-compose.yml      # Docker orchestration
├── docker-compose.prod.yml # Production overrides
├── Dockerfile              # Backend Docker image
└── README.md
```

## User Roles

| Role | Permissions |
|------|-------------|
| `user` | View metrics, export data, manage own profile |
| `admin` | All user permissions + manage users, import data, view audit logs |

## Organization Roles

| Role | Permissions |
|------|-------------|
| `viewer` | View organization data |
| `member` | Viewer permissions + create/edit metrics |
| `admin` | All permissions + manage members |

## CSV Import Format

```csv
category,metric_name,value,recorded_at
overview,pageviews,1500,2025-01-15
traffic,direct_traffic,800,2025-01-15
performance,users,2500,2025-01-15
```

## Security Considerations

- Change `JWT_SECRET` in production
- Use strong SMTP credentials for email
- Configure `CORS_ORIGIN` to your frontend domain
- Enable HTTPS in production (via reverse proxy)
- Set secure cookies in production
- Review rate limiting thresholds for your use case

## Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL is running
pg_isready

# Check connection
psql -h localhost -U postgres -d performance_metrics
```

### Redis Connection Issues
```bash
# Check Redis is running
redis-cli ping
```

### Docker Issues
```bash
# Rebuild images
docker compose build --no-cache

# View container logs
docker compose logs backend
docker compose logs frontend
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.
