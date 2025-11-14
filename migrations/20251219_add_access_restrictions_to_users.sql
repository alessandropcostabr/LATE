BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS access_restrictions JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE users
   SET access_restrictions = '{}'::jsonb
 WHERE access_restrictions IS NULL;

COMMIT;
