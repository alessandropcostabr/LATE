BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS allow_offsite_access BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_allow_offsite_access
  ON users (allow_offsite_access);

UPDATE users
   SET allow_offsite_access = true
 WHERE allow_offsite_access IS DISTINCT FROM true;

COMMIT;
