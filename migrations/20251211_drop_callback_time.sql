-- migrations/20251211_drop_callback_time.sql
-- Remove coluna legada callback_time da tabela messages.

BEGIN;

ALTER TABLE messages
  DROP COLUMN IF EXISTS callback_time;

COMMIT;
