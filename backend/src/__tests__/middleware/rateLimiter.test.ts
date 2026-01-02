import { Request, Response, NextFunction } from 'express';

// Mock redis before importing rateLimiter
jest.mock('../../config/redis', () => ({
  getRedisClient: jest.fn(() => null),
  initRedis: jest.fn(),
}));

describe('rateLimiter fail-closed behavior', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.mock('../../config/redis', () => ({
      getRedisClient: jest.fn(() => null),
      initRedis: jest.fn(),
    }));
  });

  it('should reject requests when Redis is unavailable', async () => {
    const { apiLimiter } = await import('../../middleware/rateLimiter');

    const req = {
      ip: '127.0.0.1',
      headers: {},
      path: '/api/test',
    } as Request;

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    const next = jest.fn() as NextFunction;

    // When Redis unavailable, middleware returns 503 directly (doesn't call next)
    apiLimiter(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('temporarily unavailable'),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });
});
