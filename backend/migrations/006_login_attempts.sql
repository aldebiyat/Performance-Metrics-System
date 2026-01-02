-- Migration: Create login_attempts table for account lockout mechanism
-- This table tracks failed login attempts to prevent brute force attacks

CREATE TABLE IF NOT EXISTS login_attempts (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45),
  attempted_at TIMESTAMP DEFAULT NOW()
);

-- Index for efficient lookup by email (used for lockout checks)
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);

-- Index for efficient cleanup of old attempts
CREATE INDEX IF NOT EXISTS idx_login_attempts_time ON login_attempts(attempted_at);

-- Composite index for the most common query pattern
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time ON login_attempts(email, attempted_at);
