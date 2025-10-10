-- migrations/20251007_add_messages_recipient_user_id.sql
-- Garante chave estável para relacionar recados ao destinatário (users.id).

BEGIN;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS recipient_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_recipient_user_id ON messages(recipient_user_id);

-- Tenta vincular registros existentes com base no nome atual do usuário.
UPDATE messages AS m
   SET recipient_user_id = u.id
  FROM users AS u
 WHERE m.recipient_user_id IS NULL
   AND LOWER(COALESCE(TRIM(m.recipient), '')) = LOWER(COALESCE(TRIM(u.name), ''));

COMMIT;

