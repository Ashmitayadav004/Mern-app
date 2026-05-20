-- ============================================================
-- SUPER ADMIN COMMAND CENTER — MIGRATION 001
-- Run once against your PostgreSQL database
-- ============================================================

-- ─── Extend user_role ENUM with super_admin ──────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumlabel = 'super_admin'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
    ) THEN
      ALTER TYPE user_role ADD VALUE 'super_admin';
    END IF;
  END IF;
END$$;

-- ─── Admin Staff Granular Permissions ────────────────────────
CREATE TABLE IF NOT EXISTS admin_permissions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module          VARCHAR(50)  NOT NULL,  -- cases, clients, inventory, accounting, reports, etc.
  can_view        BOOLEAN DEFAULT false,
  can_create      BOOLEAN DEFAULT false,
  can_edit        BOOLEAN DEFAULT false,
  can_delete      BOOLEAN DEFAULT false,
  can_export      BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, module)
);

CREATE INDEX IF NOT EXISTS idx_admin_permissions_user ON admin_permissions(user_id);

-- ─── Subscription Plans (DB-backed) ──────────────────────────
CREATE TABLE IF NOT EXISTS subscription_plans (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key             VARCHAR(50)  UNIQUE NOT NULL,  -- e.g. 'starter', 'professional'
  label           VARCHAR(100) NOT NULL,
  price_monthly   DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_yearly    DECIMAL(10,2),
  max_users       INTEGER DEFAULT 5,         -- -1 = unlimited
  color           VARCHAR(20) DEFAULT '#3b82f6',
  features        JSONB DEFAULT '[]',        -- array of feature strings
  is_active       BOOLEAN DEFAULT true,
  sort_order      INTEGER DEFAULT 0,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default plans if table is empty
INSERT INTO subscription_plans (key, label, price_monthly, max_users, color, features, sort_order)
SELECT * FROM (VALUES
  ('starter',      'Starter',      999,  2,  '#64748b', '["2 team users", "Basic reports", "5GB storage"]'::jsonb,         1),
  ('professional', 'Professional', 2499, 5,  '#3b82f6', '["5 team users", "Advanced reports", "20GB storage", "WhatsApp integration"]'::jsonb, 2),
  ('business',     'Business',     4999, 15, '#8b5cf6', '["15 team users", "Full analytics", "100GB storage", "API access", "Priority support"]'::jsonb, 3),
  ('enterprise',   'Enterprise',   9999, -1, '#f59e0b', '["Unlimited users", "Custom domain", "Dedicated support", "SLA guarantee"]'::jsonb, 4)
) AS v(key, label, price_monthly, max_users, color, features, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans);

-- ─── Discount Coupons ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS discount_coupons (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code            VARCHAR(30)  UNIQUE NOT NULL,    -- e.g. 'SAVE20'
  type            VARCHAR(20)  DEFAULT 'global',   -- global | user_specific
  target_email    VARCHAR(255),                    -- only for user_specific
  discount_type   VARCHAR(10)  DEFAULT 'percent',  -- percent | flat
  discount_value  DECIMAL(10,2) NOT NULL,
  max_uses        INTEGER,                         -- NULL = unlimited
  used_count      INTEGER DEFAULT 0,
  expiry_date     DATE,
  description     TEXT,
  is_active       BOOLEAN DEFAULT true,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupons_code    ON discount_coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active  ON discount_coupons(is_active);

-- ─── Platform Settings (CMS Key-Value) ───────────────────────
CREATE TABLE IF NOT EXISTS platform_settings (
  key         VARCHAR(100) PRIMARY KEY,   -- e.g. 'branding', 'seo', 'homepage', 'theme', 'saas'
  value       JSONB NOT NULL DEFAULT '{}',
  updated_by  UUID REFERENCES users(id),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default settings
INSERT INTO platform_settings (key, value) VALUES
  ('branding', '{
    "platform_name": "RecoverLab",
    "tagline": "Professional Data Recovery CRM",
    "support_email": "support@recoverlab.in",
    "support_phone": "",
    "logo_url": "",
    "favicon_url": "",
    "primary_color": "#00d4ff",
    "accent_color": "#8b5cf6"
  }'::jsonb),
  ('seo', '{
    "meta_title": "RecoverLab CRM — Professional Data Recovery Platform",
    "meta_description": "The complete SaaS CRM for data recovery labs.",
    "meta_keywords": "data recovery CRM, data recovery software",
    "og_image_url": "",
    "canonical_url": "https://recoverlab.in",
    "robots": "index, follow",
    "google_analytics_id": "",
    "sitemap_enabled": true
  }'::jsonb),
  ('homepage', '{
    "hero_title": "The Complete CRM for Data Recovery Labs",
    "hero_subtitle": "Manage cases, clients, billing and team — all in one place.",
    "hero_cta_text": "Start Free Trial",
    "hero_cta_url": "/signup",
    "announcement_enabled": false,
    "announcement_text": "",
    "show_pricing_section": true,
    "show_features_section": true,
    "show_testimonials": true,
    "show_faq": true
  }'::jsonb),
  ('saas', '{
    "maintenance_mode": false,
    "maintenance_message": "We are under scheduled maintenance. Back soon!",
    "api_rate_limit_per_hour": 1000,
    "allow_new_signups": true,
    "trial_days": 14,
    "global_announcement": ""
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ─── Two-Factor Authentication Secrets ───────────────────────
CREATE TABLE IF NOT EXISTS two_factor_auth (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  secret      TEXT NOT NULL,              -- base32 TOTP secret (store encrypted in prod)
  is_enabled  BOOLEAN DEFAULT false,
  backup_codes TEXT[],                   -- hashed backup codes
  enabled_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2FA enforcement flag on users table ─────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_fa_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_fa_enforced BOOLEAN DEFAULT false;

-- ─── SaaS Purchases / Payment Records ────────────────────────
CREATE TABLE IF NOT EXISTS saas_purchases (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_user_id      UUID NOT NULL REFERENCES users(id),         -- the admin who paid
  plan_key            VARCHAR(50) NOT NULL,
  plan_label          VARCHAR(100),
  amount              DECIMAL(10,2) NOT NULL,                     -- amount in INR (paise /100)
  currency            VARCHAR(10) DEFAULT 'INR',
  months              INTEGER DEFAULT 1,
  coupon_code         VARCHAR(30),
  discount_amount     DECIMAL(10,2) DEFAULT 0,
  -- Razorpay
  razorpay_order_id   VARCHAR(100) UNIQUE,
  razorpay_payment_id VARCHAR(100),
  razorpay_signature  TEXT,
  status              VARCHAR(20) DEFAULT 'pending',              -- pending | paid | failed | refunded
  paid_at             TIMESTAMPTZ,
  -- Invoice
  invoice_number      VARCHAR(50) UNIQUE,
  invoice_pdf_path    VARCHAR(500),
  invoice_sent_at     TIMESTAMPTZ,
  -- Meta
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchases_tenant  ON saas_purchases(tenant_user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_order   ON saas_purchases(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status  ON saas_purchases(status);

-- ─── Audit log index for super_admin action filtering ────────
CREATE INDEX IF NOT EXISTS idx_audit_action      ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_ip          ON audit_logs(ip_address);

-- ─── Triggers ────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_admin_permissions_updated
ON admin_permissions;

CREATE TRIGGER trg_admin_permissions_updated
BEFORE UPDATE ON admin_permissions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();


DROP TRIGGER IF EXISTS trg_subscription_plans_updated
ON subscription_plans;

CREATE TRIGGER trg_subscription_plans_updated
BEFORE UPDATE ON subscription_plans
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();


DROP TRIGGER IF EXISTS trg_saas_purchases_updated
ON saas_purchases;

CREATE TRIGGER trg_saas_purchases_updated
BEFORE UPDATE ON saas_purchases
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();
