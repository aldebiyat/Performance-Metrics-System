module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/__tests__/**',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  moduleFileExtensions: ['ts', 'js', 'json'],
  coverageThreshold: {
    // Core middleware must maintain high coverage
    './src/middleware/errorHandler.ts': {
      statements: 90,
      branches: 90,
      functions: 90,
      lines: 90,
    },
    './src/middleware/auth.ts': {
      statements: 90,
      branches: 80,
      functions: 90,
      lines: 90,
    },
    './src/middleware/rateLimiter.ts': {
      statements: 70,
      branches: 70,
      functions: 50,
      lines: 70,
    },
    './src/config/redis.ts': {
      statements: 90,
      branches: 60,
      functions: 90,
      lines: 90,
    },
  },
};
