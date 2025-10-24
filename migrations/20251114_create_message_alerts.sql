-- migrations/20251114_create_message_alerts.sql
-- Registra alertas recorrentes enviados por e-mail.

BEGIN;

CREATE TABLE IF NOT EXISTS message_alerts (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_message_alerts_message_type ON message_alerts (message_id, alert_type);

COMMIT;
