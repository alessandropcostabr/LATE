-- migrations/20251112_add_messages_creator.sql
-- Adiciona autoria aos recados para liberar edição condicionada ao criador.

BEGIN;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_messages_created_by ON messages (created_by);
CREATE INDEX IF NOT EXISTS idx_messages_updated_by ON messages (updated_by);

COMMIT;
