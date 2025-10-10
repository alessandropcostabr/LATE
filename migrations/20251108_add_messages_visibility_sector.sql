-- migrations/20251108_add_messages_visibility_sector.sql
-- Adiciona colunas de visibilidade e vínculo opcional com setores aos recados.

BEGIN;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS visibility TEXT;

UPDATE messages
   SET visibility = 'private'
 WHERE visibility IS NULL;

ALTER TABLE messages
  ALTER COLUMN visibility SET DEFAULT 'private',
  ALTER COLUMN visibility SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.table_constraints
     WHERE constraint_schema = current_schema()
       AND table_name = 'messages'
       AND constraint_name = 'chk_messages_visibility'
  ) THEN
    ALTER TABLE messages
      ADD CONSTRAINT chk_messages_visibility
      CHECK (visibility IN ('public', 'private'));
  END IF;
END;
$$;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS recipient_sector_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.table_constraints
     WHERE constraint_schema = current_schema()
       AND table_name = 'messages'
       AND constraint_name = 'fk_messages_recipient_sector'
  ) THEN
    ALTER TABLE messages
      ADD CONSTRAINT fk_messages_recipient_sector
      FOREIGN KEY (recipient_sector_id)
      REFERENCES sectors(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_messages_recipient_sector
    ON messages(recipient_sector_id);

COMMIT;
