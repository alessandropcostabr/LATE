-- migrations/20251210_add_callback_at.sql
-- Adiciona coluna callback_at (TIMESTAMPTZ) e índices correspondentes.

BEGIN;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS callback_at TIMESTAMPTZ;

UPDATE messages
   SET callback_at = COALESCE(
       CASE
         WHEN callback_time ~ '^[0-9]{1,2}h$' AND call_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
           THEN call_date::date + ((regexp_replace(callback_time, 'h$', '') || ':00')::time)
         WHEN callback_time ~ '^[0-9]{1,2}:[0-9]{2}$' AND call_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
           THEN call_date::date + (callback_time::time)
         WHEN callback_time ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[ T][0-9]{2}:[0-9]{2}'
           THEN replace(callback_time, ' ', 'T')::timestamptz
         ELSE NULL
       END,
       callback_at
     )
 WHERE callback_time IS NOT NULL
   AND callback_at IS NULL;

UPDATE messages
   SET callback_time = NULL
 WHERE callback_time IS NOT NULL;

DROP INDEX IF EXISTS idx_messages_callback_time;
DROP INDEX IF EXISTS idx_messages_status_cbtime;

CREATE INDEX IF NOT EXISTS idx_messages_callback_at ON messages(callback_at);
CREATE INDEX IF NOT EXISTS idx_messages_status_cb_at ON messages(status, callback_at DESC);

COMMIT;
