import { Request, Response, NextFunction } from 'express';
import { httpRequestsTotal, httpRequestDuration } from '../routes/metrics-prom';

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    httpRequestsTotal.inc({ method: req.method, route, status: res.statusCode.toString() });
    httpRequestDuration.observe({ method: req.method, route, status: res.statusCode.toString() }, duration);
  });
  next();
};
