import { Request, Response, NextFunction } from 'express';
import { isPrivateIP, metricsAuth } from '../../middleware/metricsAuth';

describe('isPrivateIP', () => {
  describe('should reject IPs that contain private ranges but are not private', () => {
    it('rejects IP containing "172." but not in private range', () => {
      // IP contains "172." but is not a private address
      expect(isPrivateIP('1.1.172.1')).toBe(false);
    });

    it('rejects 172.15.x.x (below private range)', () => {
      // 172.15 is not in 172.16-31
      expect(isPrivateIP('172.15.0.1')).toBe(false);
    });

    it('rejects 172.32.x.x (above private range)', () => {
      // 172.32 is not in 172.16-31
      expect(isPrivateIP('172.32.0.1')).toBe(false);
    });

    it('rejects IP containing "10." but not in private range', () => {
      expect(isPrivateIP('1.10.0.1')).toBe(false);
    });

    it('rejects IP containing "192.168." but not in private range', () => {
      expect(isPrivateIP('1.192.168.1')).toBe(false);
    });
  });

  describe('should allow valid private range IPs', () => {
    it('allows localhost 127.0.0.1', () => {
      expect(isPrivateIP('127.0.0.1')).toBe(true);
    });

    it('allows any 127.x.x.x address', () => {
      expect(isPrivateIP('127.255.255.255')).toBe(true);
    });

    it('allows IPv6 localhost', () => {
      expect(isPrivateIP('::1')).toBe(true);
    });

    it('allows 10.x.x.x addresses', () => {
      expect(isPrivateIP('10.0.0.1')).toBe(true);
      expect(isPrivateIP('10.255.255.255')).toBe(true);
    });

    it('allows 172.16.x.x addresses (lower bound)', () => {
      expect(isPrivateIP('172.16.0.1')).toBe(true);
    });

    it('allows 172.31.x.x addresses (upper bound)', () => {
      expect(isPrivateIP('172.31.255.255')).toBe(true);
    });

    it('allows 192.168.x.x addresses', () => {
      expect(isPrivateIP('192.168.1.1')).toBe(true);
      expect(isPrivateIP('192.168.255.255')).toBe(true);
    });

    it('allows IPv6-mapped IPv4 private addresses', () => {
      expect(isPrivateIP('::ffff:127.0.0.1')).toBe(true);
      expect(isPrivateIP('::ffff:10.0.0.1')).toBe(true);
      expect(isPrivateIP('::ffff:192.168.1.1')).toBe(true);
    });
  });

  describe('should reject public IPs', () => {
    it('rejects Google DNS', () => {
      expect(isPrivateIP('8.8.8.8')).toBe(false);
    });

    it('rejects documentation range IP', () => {
      expect(isPrivateIP('203.0.113.1')).toBe(false);
    });

    it('rejects arbitrary public IP', () => {
      expect(isPrivateIP('54.239.28.85')).toBe(false);
    });
  });

  describe('should handle edge cases', () => {
    it('rejects invalid IP formats', () => {
      expect(isPrivateIP('not-an-ip')).toBe(false);
      expect(isPrivateIP('')).toBe(false);
      expect(isPrivateIP('256.0.0.1')).toBe(false);
      expect(isPrivateIP('1.2.3')).toBe(false);
      expect(isPrivateIP('1.2.3.4.5')).toBe(false);
    });

    it('rejects negative octet values', () => {
      expect(isPrivateIP('-1.0.0.1')).toBe(false);
    });
  });
});

describe('metricsAuth middleware', () => {
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  const createMockRequest = (ip: string, headers: Record<string, string> = {}): Partial<Request> => ({
    ip,
    headers,
    socket: { remoteAddress: ip } as any,
  });

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
    delete process.env.METRICS_TOKEN;
  });

  afterEach(() => {
    delete process.env.METRICS_TOKEN;
  });

  describe('without METRICS_TOKEN configured', () => {
    it('allows access from localhost', () => {
      const mockReq = createMockRequest('127.0.0.1');

      metricsAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('allows access from IPv6 localhost', () => {
      const mockReq = createMockRequest('::1');

      metricsAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('allows access from private 10.x.x.x network', () => {
      const mockReq = createMockRequest('10.0.0.1');

      metricsAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('allows access from private 172.16-31.x.x network', () => {
      const mockReq = createMockRequest('172.16.0.1');

      metricsAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('allows access from private 192.168.x.x network', () => {
      const mockReq = createMockRequest('192.168.1.1');

      metricsAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('denies access from public IP', () => {
      const mockReq = createMockRequest('8.8.8.8');

      metricsAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Metrics endpoint restricted to internal access',
      });
    });

    it('denies access from IP containing private substring but not private', () => {
      const mockReq = createMockRequest('1.1.172.1'); // Contains "172." but is public

      metricsAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('falls back to socket.remoteAddress when req.ip is undefined', () => {
      const mockReq: Partial<Request> = {
        ip: undefined,
        headers: {},
        socket: { remoteAddress: '10.0.0.1' } as any,
      };

      metricsAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('with METRICS_TOKEN configured', () => {
    beforeEach(() => {
      process.env.METRICS_TOKEN = 'test-metrics-token';
    });

    it('allows access with valid bearer token', () => {
      const mockReq = createMockRequest('8.8.8.8', { authorization: 'Bearer test-metrics-token' });

      metricsAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('denies access with invalid bearer token', () => {
      const mockReq = createMockRequest('8.8.8.8', { authorization: 'Bearer wrong-token' });

      metricsAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('denies access without authorization header', () => {
      const mockReq = createMockRequest('8.8.8.8');

      metricsAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('denies access with malformed authorization header', () => {
      const mockReq = createMockRequest('8.8.8.8', { authorization: 'test-metrics-token' }); // Missing "Bearer " prefix

      metricsAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });
});
