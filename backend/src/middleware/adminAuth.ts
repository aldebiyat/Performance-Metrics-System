import { Request, Response, NextFunction } from 'express';
import { Errors } from './errorHandler';

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw Errors.unauthorized('Authentication required');
  }

  if (req.user.role !== 'admin') {
    throw Errors.forbidden('Admin access required');
  }

  next();
};
