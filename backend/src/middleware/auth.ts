import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { TokenPayload } from '../types';
import { Errors } from './errorHandler';

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

export const generateAccessToken = (payload: TokenPayload): string => {
  const expiresIn = process.env.JWT_ACCESS_EXPIRY || '15m';
  return jwt.sign(payload, getJwtSecret(), { expiresIn } as jwt.SignOptions);
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  const expiresIn = process.env.JWT_REFRESH_EXPIRY || '7d';
  return jwt.sign(payload, getJwtSecret(), { expiresIn } as jwt.SignOptions);
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, getJwtSecret()) as TokenPayload;
};

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw Errors.unauthorized('No token provided');
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    throw Errors.unauthorized('Invalid or expired token');
  }
};

// Optional authentication - sets user if token exists but doesn't fail
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = verifyToken(token);
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
