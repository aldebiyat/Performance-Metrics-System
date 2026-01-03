import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

export const generateCsrfToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF check for safe methods
  if (SAFE_METHODS.includes(req.method)) {
    return next();
  }

  const headerToken = req.headers['x-csrf-token'] as string;
  const cookieToken = req.cookies?.csrf_token;

  if (!headerToken || !cookieToken) {
    return res.status(403).json({
      success: false,
      error: 'CSRF token missing',
    });
  }

  // Constant-time comparison to prevent timing attacks
  try {
    if (!crypto.timingSafeEqual(Buffer.from(headerToken), Buffer.from(cookieToken))) {
      return res.status(403).json({
        success: false,
        error: 'CSRF token invalid',
      });
    }
  } catch {
    // Handle buffer length mismatch
    return res.status(403).json({
      success: false,
      error: 'CSRF token invalid',
    });
  }

  next();
};
