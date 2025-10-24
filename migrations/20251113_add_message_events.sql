-- migrations/20251113_add_message_events.sql
-- Cria tabela de eventos de recados (histórico leve).

BEGIN;

CREATE TABLE IF NOT EXISTS message_events (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_message_events_message_id ON message_events (message_id);
CREATE INDEX IF NOT EXISTS idx_message_events_event_type ON message_events (event_type);

COMMIT;
