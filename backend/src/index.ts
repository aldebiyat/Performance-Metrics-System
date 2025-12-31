import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { runMigrations } from './utils/seedData';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter, initRateLimitRedis } from './middleware/rateLimiter';
import { requestLogger } from './middleware/requestLogger';
import logger from './config/logger';
import authRoutes from './routes/auth';
import metricsRoutes from './routes/metrics';
import exportRoutes from './routes/export';

// Load environment variables
dotenv.config();

const app = express();

// Trust proxy - required for rate limiting when behind a reverse proxy (e.g., nginx, load balancer)
// This ensures req.ip returns the client's real IP from X-Forwarded-For header
app.set('trust proxy', 1);

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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/export', exportRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5001;

async function startServer() {
  try {
    // Initialize database and seed data
    await runMigrations();

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
