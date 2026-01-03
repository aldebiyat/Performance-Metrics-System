import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { TokenPayload } from '../types';
import { Errors } from './errorHandler';
import { tokenBlacklistService } from '../services/tokenBlacklistService';
import logger from '../config/logger';

const JWT_ISSUER = process.env.JWT_ISSUER || 'pms-api';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'pms-client';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return secret;
};

const getJwtRefreshSecret = (): string => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_REFRESH_SECRET must be set in production');
    }
    // Allow fallback in development only
    logger.warn('JWT_REFRESH_SECRET not set, using JWT_SECRET for refresh tokens. This is insecure.');
    return getJwtSecret();
  }
  return secret;
};

export const generateAccessToken = (payload: TokenPayload): string => {
  const expiresIn = process.env.JWT_ACCESS_EXPIRY || '15m';
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn,
    algorithm: 'HS256',
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE
  } as jwt.SignOptions);
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  const expiresIn = process.env.JWT_REFRESH_EXPIRY || '7d';
  return jwt.sign(payload, getJwtRefreshSecret(), {
    expiresIn,
    algorithm: 'HS256',
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE
  } as jwt.SignOptions);
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, getJwtSecret(), {
    algorithms: ['HS256'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE
  }) as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, getJwtRefreshSecret(), {
    algorithms: ['HS256'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE
  }) as TokenPayload;
};

// Keep verifyToken for backward compatibility (uses access token secret)
export const verifyToken = verifyAccessToken;

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw Errors.unauthorized('No token provided');
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token);

    // Check if token is blacklisted (use hash of token for key)
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex').substring(0, 16);
    const isBlacklisted = await tokenBlacklistService.isBlacklisted(tokenHash);
    if (isBlacklisted) {
      throw Errors.unauthorized('Token has been revoked');
    }

    // Check if user's tokens were invalidated after this token was issued
    if (decoded.iat) {
      const invalidatedAt = await tokenBlacklistService.getUserTokensInvalidatedAt(decoded.userId);
      if (invalidatedAt && decoded.iat * 1000 < invalidatedAt) {
        throw Errors.unauthorized('Token has been invalidated');
      }
    }

    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof Error && error.message.includes('Token has been')) {
      throw error;
    }
    throw Errors.unauthorized('Invalid or expired token');
  }
};

// Optional authentication - sets user if token exists but doesn't fail
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = verifyToken(token);

      // Check if token is blacklisted
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex').substring(0, 16);
      const isBlacklisted = await tokenBlacklistService.isBlacklisted(tokenHash);
      if (isBlacklisted) {
        return next(); // Don't set user for blacklisted tokens
      }

      // Check if user's tokens were invalidated
      if (decoded.iat) {
        const invalidatedAt = await tokenBlacklistService.getUserTokensInvalidatedAt(decoded.userId);
        if (invalidatedAt && decoded.iat * 1000 < invalidatedAt) {
          return next();
        }
      }

      req.user = decoded;
    } catch {
      // Ignore invalid tokens for optional auth
    }
  }

  next();
};

// Role-based authorization
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw Errors.unauthorized('Not authenticated');
    }

    if (!roles.includes(req.user.role)) {
      throw Errors.forbidden('Insufficient permissions');
    }

    next();
  };
};
