/**
 * Tests for API client configuration
 */

describe('API Client', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules before each test to ensure fresh imports
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('REACT_APP_API_URL environment variable', () => {
    it('should throw an error when REACT_APP_API_URL is not set', () => {
      // Remove the env var
      delete process.env.REACT_APP_API_URL;

      // Importing the module should throw
      expect(() => {
        require('../client');
      }).toThrow('REACT_APP_API_URL environment variable is required');
    });

    it('should throw an error when REACT_APP_API_URL is empty string', () => {
      process.env.REACT_APP_API_URL = '';

      expect(() => {
        require('../client');
      }).toThrow('REACT_APP_API_URL environment variable is required');
    });

    it('should not throw when REACT_APP_API_URL is set', () => {
      process.env.REACT_APP_API_URL = 'https://api.example.com';

      expect(() => {
        require('../client');
      }).not.toThrow();
    });
  });
});
