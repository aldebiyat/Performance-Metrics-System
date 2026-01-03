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
    expect(req.requestId).toBe(req.headers['x-request-id']);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', req.headers['x-request-id']);
    expect(next).toHaveBeenCalled();
  });

  it('should preserve existing valid request ID from header', () => {
    const existingId = 'existing-request-id-123';
    const req = { headers: { 'x-request-id': existingId } } as unknown as Request;
    const res = {
      setHeader: jest.fn(),
    } as unknown as Response;
    const next = jest.fn();

    requestIdMiddleware(req, res, next);

    expect(req.headers['x-request-id']).toBe(existingId);
    expect(req.requestId).toBe(existingId);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', existingId);
  });

  it('should reject invalid request IDs and generate new one', () => {
    // Test log injection attempt
    const maliciousId = 'abc\nINFO: hacked';
    const req = { headers: { 'x-request-id': maliciousId } } as unknown as Request;
    const res = {
      setHeader: jest.fn(),
    } as unknown as Response;
    const next = jest.fn();

    requestIdMiddleware(req, res, next);

    // Should generate new UUID, not use malicious one
    expect(req.headers['x-request-id']).not.toBe(maliciousId);
    expect(req.headers['x-request-id']).toMatch(/^[a-f0-9-]{36}$/);
    expect(req.requestId).toBe(req.headers['x-request-id']);
    expect(next).toHaveBeenCalled();
  });

  it('should reject overly long request IDs', () => {
    const longId = 'a'.repeat(100);
    const req = { headers: { 'x-request-id': longId } } as unknown as Request;
    const res = {
      setHeader: jest.fn(),
    } as unknown as Response;
    const next = jest.fn();

    requestIdMiddleware(req, res, next);

    // Should generate new UUID, not use long one
    expect(req.headers['x-request-id']).not.toBe(longId);
    expect(req.headers['x-request-id']).toMatch(/^[a-f0-9-]{36}$/);
    expect(req.requestId).toBe(req.headers['x-request-id']);
    expect(next).toHaveBeenCalled();
  });

  it('should reject request IDs with special characters', () => {
    const specialCharsId = 'abc<script>alert(1)</script>';
    const req = { headers: { 'x-request-id': specialCharsId } } as unknown as Request;
    const res = {
      setHeader: jest.fn(),
    } as unknown as Response;
    const next = jest.fn();

    requestIdMiddleware(req, res, next);

    // Should generate new UUID, not use one with special characters
    expect(req.headers['x-request-id']).not.toBe(specialCharsId);
    expect(req.headers['x-request-id']).toMatch(/^[a-f0-9-]{36}$/);
    expect(next).toHaveBeenCalled();
  });

  it('should accept valid request IDs with allowed characters', () => {
    const validId = 'valid_request-ID_123';
    const req = { headers: { 'x-request-id': validId } } as unknown as Request;
    const res = {
      setHeader: jest.fn(),
    } as unknown as Response;
    const next = jest.fn();

    requestIdMiddleware(req, res, next);

    expect(req.headers['x-request-id']).toBe(validId);
    expect(req.requestId).toBe(validId);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', validId);
  });
});
