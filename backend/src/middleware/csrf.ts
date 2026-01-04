import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

// Pre-auth endpoints that don't need CSRF protection (chicken-egg problem)
const EXEMPT_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/refresh',
];

export const generateCsrfToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const setCsrfCookie = (res: Response, csrfToken: string): void => {
  res.cookie('csrf_token', csrfToken, {
    httpOnly: false, // Client JS must be able to read it
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
};

export const csrfProtection = (req: Request, res: Response, next: NextFunction): void => {
  // Skip CSRF check for safe methods
  if (SAFE_METHODS.includes(req.method)) {
    next();
    return;
  }

  // Skip for exempt paths (pre-auth endpoints)
  if (EXEMPT_PATHS.some(path => req.path.startsWith(path))) {
    next();
    return;
  }

  const headerToken = req.headers['x-csrf-token'] as string;
  const cookieToken = req.cookies?.csrf_token;

  if (!headerToken || !cookieToken) {
    res.status(403).json({
      success: false,
      error: 'CSRF token missing',
    });
    return;
  }

  // Constant-time comparison to prevent timing attacks
  try {
    if (!crypto.timingSafeEqual(Buffer.from(headerToken), Buffer.from(cookieToken))) {
      res.status(403).json({
        success: false,
        error: 'CSRF token invalid',
      });
      return;
    }
  } catch {
    // Handle buffer length mismatch
    res.status(403).json({
      success: false,
      error: 'CSRF token invalid',
    });
    return;
  }

  next();
};
