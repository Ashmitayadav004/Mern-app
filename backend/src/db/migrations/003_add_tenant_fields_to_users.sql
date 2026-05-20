-- ============================================================
-- MIGRATION 003: Add Tenant/Subscriber fields to users table
-- These columns store subscription and company details for
-- admin users who are tenants (subscribers) of the platform.
-- ============================================================

-- Subscription plan key (e.g. 'starter', 'professional', 'business', 'enterprise')
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'starter';

-- Subscription expiry timestamp
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expiry TIMESTAMPTZ;

-- Maximum allowed team users for this subscriber
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_team_users INTEGER DEFAULT 5;

-- Company / lab name for the subscriber
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name VARCHAR(200);

-- City of the subscriber
ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100);

-- Subscription status: active | trial | suspended | expired | cancelled
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'active';

-- Points to the owner/admin user for team members of a tenant
-- Team members have tenant_owner_id = the admin's id
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_owner_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_subscription_plan   ON users(subscription_plan);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);
CREATE INDEX IF NOT EXISTS idx_users_tenant_owner        ON users(tenant_owner_id);
