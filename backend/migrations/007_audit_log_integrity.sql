-- Up Migration
-- Add hash chain columns for audit log integrity protection
ALTER TABLE audit_logs ADD COLUMN previous_hash VARCHAR(64);
ALTER TABLE audit_logs ADD COLUMN entry_hash VARCHAR(64);

-- Add index for efficient hash lookups
CREATE INDEX idx_audit_logs_entry_hash ON audit_logs(entry_hash);

-- @down
DROP INDEX IF EXISTS idx_audit_logs_entry_hash;
ALTER TABLE audit_logs DROP COLUMN IF EXISTS previous_hash;
ALTER TABLE audit_logs DROP COLUMN IF EXISTS entry_hash;
