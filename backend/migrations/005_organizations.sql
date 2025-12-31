-- Migration: 005_organizations
-- Description: Add multi-tenancy support with organizations

-- Up Migration
CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS organization_members (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_organizations_slug ON organizations(slug);

-- Add organization_id to users for current org context
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_organization_id INTEGER REFERENCES organizations(id);

-- Trigger for organizations updated_at
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- @down
ALTER TABLE users DROP COLUMN IF EXISTS current_organization_id;
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
DROP TABLE IF EXISTS organization_members;
DROP TABLE IF EXISTS organizations;
