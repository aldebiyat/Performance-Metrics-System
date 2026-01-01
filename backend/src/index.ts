import * as Sentry from '@sentry/node';
import express from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { runMigrations } from './utils/seedData';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter, initRateLimitRedis } from './middleware/rateLimiter';
import { requestLogger } from './middleware/requestLogger';
import logger from './config/logger';
import { swaggerSpec } from './config/swagger';
import { initRedis } from './config/redis';
import authRoutes from './routes/auth';
import metricsRoutes from './routes/metrics';
import exportRoutes from './routes/export';
import importRoutes from './routes/import';
import passwordResetRoutes from './routes/passwordReset';
import adminRoutes from './routes/admin';
import organizationRoutes from './routes/organizations';
import healthRoutes from './routes/health';

// Load environment variables
dotenv.config();

// Initialize Sentry before anything else
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  });
}

const app = express();

// Trust proxy - required for rate limiting when behind a reverse proxy (e.g., nginx, load balancer)
// This ensures req.ip returns the client's real IP from X-Forwarded-For header
app.set('trust proxy', 1);

// Compression middleware - compress responses for better performance
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6, // Default compression level (0-9)
  threshold: 1024, // Only compress responses > 1KB
}));

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json());

// Request logging middleware
app.use(requestLogger);

// Security headers
app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    scriptSrc: ["'self'"],
    imgSrc: ["'self'", "data:", "blob:"],
  },
}));

// Apply rate limiting to all API routes
app.use('/api', apiLimiter);

// Swagger API documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check endpoints
app.use('/api/health', healthRoutes);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/auth', passwordResetRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/import', importRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/organizations', organizationRoutes);

// Sentry error handler (must be before other error handlers)
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler());
}

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5001;

async function startServer() {
  try {
    // Initialize database and seed data
    await runMigrations();

    // Initialize Redis for caching
    await initRedis();

    // Initialize Redis for rate limiting (optional)
    await initRateLimitRedis();

    app.listen(PORT, () => {
      logger.info(`Server is running on http://localhost:${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
