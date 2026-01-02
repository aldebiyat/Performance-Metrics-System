import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { getRedisClient } from '../config/redis';
import { asyncHandler } from '../middleware/errorHandler';
import logger from '../config/logger';

const router = Router();

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  checks: {
    database: { status: 'up' | 'down'; latency?: number };
    redis: { status: 'up' | 'down' | 'not_configured'; latency?: number };
  };
}

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    checks: {
      database: { status: 'down' },
      redis: { status: 'not_configured' },
    },
  };

  // Check database
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    health.checks.database = { status: 'up', latency: Date.now() - start };
  } catch (error) {
    health.checks.database = { status: 'down' };
    logger.error('Health check database error:', error);
    health.status = 'unhealthy';
  }

  // Check Redis
  const redisClient = getRedisClient();
  if (redisClient) {
    try {
      const start = Date.now();
      await redisClient.ping();
      health.checks.redis = { status: 'up', latency: Date.now() - start };
    } catch (error) {
      health.checks.redis = { status: 'down' };
      logger.error('Health check Redis error:', error);
      health.status = 'degraded';
    }
  }

  const statusCode = health.status === 'unhealthy' ? 503 : 200;
  res.status(statusCode).json(health);
}));

// Liveness probe
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Readiness probe
router.get('/ready', asyncHandler(async (req: Request, res: Response) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not_ready' });
  }
}));

export default router;
