// Mock logger
const mockLogger = {
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../config/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));

// Mock redis with dynamic mock implementation
const mockOn = jest.fn();
const mockConnect = jest.fn();
const mockQuit = jest.fn();

jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    on: mockOn,
    connect: mockConnect,
    quit: mockQuit,
  })),
}));

import { createClient } from 'redis';
import { getRedisClient, initRedis, closeRedis } from '../config/redis';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

describe('Redis Config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment
    delete process.env.REDIS_URL;
    delete process.env.REDIS_PASSWORD;
    // Reset mock implementations
    mockConnect.mockReset();
    mockConnect.mockResolvedValue(undefined);
    mockQuit.mockReset();
    mockQuit.mockResolvedValue(undefined);
    mockOn.mockReset();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getRedisClient', () => {
    it('should return null when Redis is not initialized', () => {
      // Since we haven't called initRedis with a valid REDIS_URL, should return null
      const client = getRedisClient();
      expect(client).toBeNull();
    });
  });

  describe('initRedis', () => {
    it('should log info when REDIS_URL is not set', async () => {
      delete process.env.REDIS_URL;

      await initRedis();

      expect(mockLogger.info).toHaveBeenCalledWith('REDIS_URL not set, using memory cache');
      // createClient should not be called since this test runs after module initialization
    });

    it('should attempt to connect when REDIS_URL is set', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';

      await initRedis();

      expect(mockCreateClient).toHaveBeenCalled();
      expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('reconnecting', expect.any(Function));
      expect(mockConnect).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Connected to Redis');
    });

    it('should handle password from REDIS_PASSWORD env var', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.REDIS_PASSWORD = 'secret123';

      await initRedis();

      expect(mockCreateClient).toHaveBeenCalledWith({
        url: expect.stringContaining('secret123'),
      });
    });

    it('should not override password if already in URL', async () => {
      process.env.REDIS_URL = 'redis://:existingpass@localhost:6379';
      process.env.REDIS_PASSWORD = 'newpassword';

      await initRedis();

      expect(mockCreateClient).toHaveBeenCalledWith({
        url: expect.stringContaining('existingpass'),
      });
    });

    it('should handle connection failure gracefully', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      mockConnect.mockRejectedValueOnce(new Error('Connection refused'));

      await initRedis();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to connect to Redis, using memory cache',
        expect.objectContaining({ error: 'Connection refused' })
      );
    });

    it('should handle non-Error connection failures', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      mockConnect.mockRejectedValueOnce('string error');

      await initRedis();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to connect to Redis, using memory cache',
        expect.objectContaining({ error: 'Unknown error' })
      );
    });
  });

  describe('closeRedis', () => {
    it('should close Redis client when initialized', async () => {
      // First initialize Redis
      process.env.REDIS_URL = 'redis://localhost:6379';
      await initRedis();

      // Then close it
      await closeRedis();

      expect(mockQuit).toHaveBeenCalled();
    });
  });

  describe('Redis event handlers', () => {
    it('should log error on Redis error event', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';

      await initRedis();

      // Find and call the error handler
      const errorHandler = mockOn.mock.calls.find(call => call[0] === 'error')?.[1];
      expect(errorHandler).toBeDefined();

      const testError = new Error('Test Redis error');
      errorHandler(testError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Redis Client Error',
        expect.objectContaining({ error: 'Test Redis error' })
      );
    });

    it('should log info on Redis reconnecting event', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';

      await initRedis();

      // Find and call the reconnecting handler
      const reconnectingHandler = mockOn.mock.calls.find(call => call[0] === 'reconnecting')?.[1];
      expect(reconnectingHandler).toBeDefined();

      reconnectingHandler();

      expect(mockLogger.info).toHaveBeenCalledWith('Redis reconnecting...');
    });
  });
});
