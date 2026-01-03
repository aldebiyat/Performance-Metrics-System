import { Request, Response, NextFunction } from 'express';
import { requestIdMiddleware } from '../../middleware/requestId';

describe('requestId middleware', () => {
  it('should generate request ID if not present', () => {
    const req = { headers: {} } as unknown as Request;
    const res = {
      setHeader: jest.fn(),
    } as unknown as Response;
    const next = jest.fn();

    requestIdMiddleware(req, res, next);

    expect(req.headers['x-request-id']).toBeDefined();
    expect(req.headers['x-request-id']).toMatch(/^[a-f0-9-]{36}$/);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', req.headers['x-request-id']);
    expect(next).toHaveBeenCalled();
  });

  it('should preserve existing request ID from header', () => {
    const existingId = 'existing-request-id-123';
    const req = { headers: { 'x-request-id': existingId } } as unknown as Request;
    const res = {
      setHeader: jest.fn(),
    } as unknown as Response;
    const next = jest.fn();

    requestIdMiddleware(req, res, next);

    expect(req.headers['x-request-id']).toBe(existingId);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', existingId);
  });
});
