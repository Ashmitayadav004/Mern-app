-- Add user permissions JSONB column for custom role overrides
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS permissions JSONB;
