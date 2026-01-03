import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

// Validate request ID format - only allow alphanumeric, hyphens, and underscores
const isValidRequestId = (id: string): boolean => {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(id);
};

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const externalId = req.headers['x-request-id'] as string;

  // Use external ID only if it's valid, otherwise generate new UUID
  const requestId = (externalId && isValidRequestId(externalId)) ? externalId : randomUUID();

  req.headers['x-request-id'] = requestId;
  req.requestId = requestId;  // Also set on req object for easy access
  res.setHeader('X-Request-ID', requestId);

  next();
};
