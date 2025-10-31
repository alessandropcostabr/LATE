-- Sprint D — Relacionamento
-- Ajustes na tabela messages para relacionamento entre registros e performance de buscas.

BEGIN;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS parent_message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_parent_message_id ON messages (parent_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_phone ON messages (sender_phone);
CREATE INDEX IF NOT EXISTS idx_messages_sender_email ON messages (sender_email);

COMMIT;
