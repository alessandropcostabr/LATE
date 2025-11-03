BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1;

UPDATE users
   SET session_version = 1
 WHERE session_version IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_session_version
  ON users(session_version);

COMMIT;
