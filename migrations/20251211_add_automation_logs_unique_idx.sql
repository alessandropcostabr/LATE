-- migrations/20251211_add_automation_logs_unique_idx.sql
-- Garante idempotência nas automations, normalizando timestamp ao minuto.

BEGIN;

ALTER TABLE automation_logs
  ADD COLUMN IF NOT EXISTS created_at_minute TIMESTAMPTZ;

UPDATE automation_logs
   SET created_at_minute = date_trunc('minute', created_at)
 WHERE created_at_minute IS NULL;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY automation_id,
                   COALESCE(message_id, -1),
                   created_at_minute
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM automation_logs
)
DELETE FROM automation_logs
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

ALTER TABLE automation_logs
  ALTER COLUMN created_at_minute SET NOT NULL,
  ALTER COLUMN created_at_minute SET DEFAULT date_trunc('minute', NOW());

CREATE UNIQUE INDEX IF NOT EXISTS uniq_automation_logs_minute
  ON automation_logs (automation_id, COALESCE(message_id, -1), created_at_minute);

COMMIT;
