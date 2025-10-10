-- migrations/20251106_add_messages_recipient_user_id.sql
-- Adiciona coluna com identificador imutável do destinatário para reforçar integridade.
BEGIN;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS recipient_user_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.table_constraints
     WHERE constraint_schema = current_schema()
       AND table_name = 'messages'
       AND constraint_name = 'fk_messages_recipient_user'
  ) THEN
    ALTER TABLE messages
      ADD CONSTRAINT fk_messages_recipient_user
      FOREIGN KEY (recipient_user_id)
      REFERENCES users(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

WITH normalized_users AS (
  SELECT id, normalized_name
    FROM (
      SELECT id,
             LOWER(TRIM(name)) AS normalized_name,
             COUNT(*) OVER (PARTITION BY LOWER(TRIM(name))) AS normalized_count
        FROM users
    ) uniq
   WHERE normalized_name IS NOT NULL
     AND normalized_name <> ''
     AND normalized_count = 1
)
UPDATE messages m
   SET recipient_user_id = nu.id
  FROM normalized_users nu
 WHERE m.recipient_user_id IS NULL
   AND LENGTH(TRIM(COALESCE(m.recipient, ''))) > 0
   AND LOWER(TRIM(m.recipient)) = nu.normalized_name;

CREATE INDEX IF NOT EXISTS idx_messages_recipient_user_id
    ON messages(recipient_user_id);

COMMIT;
