import * as Sentry from '@sentry/node';
import express, { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { runMigrations } from './utils/seedData';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter, initRateLimitRedis } from './middleware/rateLimiter';
import { requestLogger } from './middleware/requestLogger';
import logger from './config/logger';
import { swaggerSpec } from './config/swagger';
import { initRedis, closeRedis } from './config/redis';
import pool from './config/database';
import authRoutes from './routes/auth';
import metricsRoutes from './routes/metrics';
import prometheusMetricsRoutes from './routes/metrics-prom';
import exportRoutes from './routes/export';
import { metricsMiddleware } from './middleware/metrics';
import { metricsAuth } from './middleware/metricsAuth';
import { csrfProtection } from './middleware/csrf';
import { requestIdMiddleware } from './middleware/requestId';
import importRoutes from './routes/import';
import passwordResetRoutes from './routes/passwordReset';
import adminRoutes from './routes/admin';
import organizationRoutes from './routes/organizations';
import healthRoutes from './routes/health';
import securityRoutes from './routes/security';

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

// Trust proxy - configurable for different deployment environments
// Set to number (1-5) for proxy hops, or 'loopback' for localhost only
const trustProxy = process.env.TRUST_PROXY || '1';
app.set('trust proxy', /^\d+$/.test(trustProxy) ? parseInt(trustProxy, 10) : trustProxy);

// Add request ID tracking (before other middleware)
app.use(requestIdMiddleware);

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
  origin: process.env.CORS_ORIGIN
    ?.split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0)
    || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
};

app.use(cors(corsOptions));
app.use(express.json({
  limit: process.env.MAX_REQUEST_SIZE || '1mb'
}));
app.use(express.urlencoded({
  extended: true,
  limit: process.env.MAX_REQUEST_SIZE || '1mb'
}));
app.use(cookieParser());

// Content-Type validation for requests with body
app.use((req: Request, res: Response, next: NextFunction): void => {
  const methodsWithBody = ['POST', 'PUT', 'PATCH'];

  if (methodsWithBody.includes(req.method)) {
    const contentType = req.get('Content-Type');
    const contentLength = req.headers['content-length'];

    // Only validate if there's a body
    if (contentLength && contentLength !== '0') {
      if (!contentType) {
        res.status(415).json({
          success: false,
          error: 'Content-Type header is required for requests with a body',
        });
        return;
      }

      const allowedTypes = ['application/json', 'multipart/form-data', 'application/x-www-form-urlencoded'];
      const isAllowed = allowedTypes.some(type => contentType.includes(type));

      if (!isAllowed) {
        res.status(415).json({
          success: false,
          error: 'Unsupported Content-Type',
        });
        return;
      }
    }
  }

  next();
});

// Prometheus metrics middleware - must be early to capture all requests
app.use(metricsMiddleware);

// Request logging middleware
app.use(requestLogger);

// Security headers
app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'"],
    scriptSrc: ["'self'"],
    imgSrc: ["'self'", "data:", "blob:"],
  },
}));

// Security.txt route (RFC 9116) - must be accessible without authentication
app.use(securityRoutes);

// Apply rate limiting to all API routes
app.use('/api', ...apiLimiter);

// Apply CSRF protection to API routes (after cookie parser, before routes)
app.use('/api', csrfProtection);

// Swagger API documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check endpoints
app.use('/api/health', healthRoutes);

// Prometheus metrics endpoint (for scraping)
app.use('/metrics', metricsAuth, prometheusMetricsRoutes);

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
  Sentry.setupExpressErrorHandler(app);
}

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5001;

let server: ReturnType<typeof app.listen> | null = null;

async function startServer() {
  // Validate required environment variables in production
  if (process.env.NODE_ENV === 'production') {
    const requiredVars = [
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'DB_HOST',
      'CORS_ORIGIN',
    ];
    const missing = requiredVars.filter(v => !process.env[v]);
    if (missing.length > 0) {
      logger.error(`Missing required environment variables: ${missing.join(', ')}`);
      process.exit(1);
    }

    // Ensure JWT secrets are different
    if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
      logger.error('JWT_SECRET and JWT_REFRESH_SECRET must be different');
      process.exit(1);
    }
  }

  try {
    // Initialize database and seed data
    await runMigrations();

    // Initialize Redis for caching
    await initRedis();

    // Initialize Redis for rate limiting (optional)
    await initRateLimitRedis();

    server = app.listen(PORT, () => {
      logger.info(`Server is running on http://localhost:${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Set request timeouts for DoS protection
    server.timeout = parseInt(process.env.SERVER_TIMEOUT_MS || '120000', 10);
    server.keepAliveTimeout = parseInt(process.env.KEEP_ALIVE_TIMEOUT_MS || '65000', 10);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // Stop accepting new connections
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        // Close Redis connections
        await closeRedis();
        logger.info('Redis connections closed');

        // Close database pool
        await pool.end();
        logger.info('Database pool closed');

        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }

  // Force exit after 30 seconds
  setTimeout(() => {
    logger.error('Graceful shutdown timeout - forcing exit');
    process.exit(1);
  }, 30000);
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();
