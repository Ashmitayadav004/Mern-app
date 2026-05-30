BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_admin_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_name = kcu.table_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'users'
      AND kcu.column_name = 'assigned_admin_id'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_assigned_admin_fk FOREIGN KEY (assigned_admin_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END$$;

UPDATE users
SET assigned_admin_id = tenant_owner_id
WHERE assigned_admin_id IS NULL
  AND tenant_owner_id IS NOT NULL
  AND role NOT IN ('admin','super_admin');

COMMIT;
