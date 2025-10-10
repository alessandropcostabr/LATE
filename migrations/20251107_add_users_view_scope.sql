-- migrations/20251107_add_users_view_scope.sql
-- Adiciona coluna view_scope para controlar visibilidade de recados (own/all).

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS view_scope TEXT;

UPDATE users
   SET view_scope = 'all'
 WHERE view_scope IS NULL;

ALTER TABLE users
  ALTER COLUMN view_scope SET DEFAULT 'all',
  ALTER COLUMN view_scope SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.table_constraints
     WHERE constraint_schema = current_schema()
       AND table_name = 'users'
       AND constraint_name = 'chk_users_view_scope'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT chk_users_view_scope
      CHECK (view_scope IN ('own', 'all'));
  END IF;
END;
$$;

COMMIT;
