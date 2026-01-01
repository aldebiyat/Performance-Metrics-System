export const config = {
  // Auth
  saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
  accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
  refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  refreshTokenDays: parseInt(process.env.REFRESH_TOKEN_DAYS || '7', 10),
  verificationTokenHours: parseInt(process.env.VERIFICATION_TOKEN_HOURS || '24', 10),
  passwordResetTokenHours: parseInt(process.env.PASSWORD_RESET_TOKEN_HOURS || '1', 10),

  // Rate limiting
  rateLimit: {
    api: {
      windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW_MS || '60000', 10),
      max: parseInt(process.env.RATE_LIMIT_API_MAX || '100', 10),
    },
    auth: {
      windowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS || '60000', 10),
      max: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '5', 10),
    },
    passwordReset: {
      windowMs: parseInt(process.env.RATE_LIMIT_RESET_WINDOW_MS || '3600000', 10),
      max: parseInt(process.env.RATE_LIMIT_RESET_MAX || '3', 10),
    },
  },

  // Cache
  cacheTtl: parseInt(process.env.CACHE_TTL_SECONDS || '300', 10),

  // Compression
  compressionThreshold: parseInt(process.env.COMPRESSION_THRESHOLD || '1024', 10),
  compressionLevel: parseInt(process.env.COMPRESSION_LEVEL || '6', 10),
};
