import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError, ZodIssue } from 'zod';
import { Errors } from '../middleware/errorHandler';

export const validate = (schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = schema.parse(req[source]);
      req[source] = data; // Replace with validated/transformed data
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const message = error.issues.map((e: ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw Errors.validation(message);
      }
      throw error;
    }
  };
};

export * from './auth';
export * from './metrics';
