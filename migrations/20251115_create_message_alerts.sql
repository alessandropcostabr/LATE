-- migrations/20251115_create_message_alerts.sql
-- Registra envios recorrentes de alertas de recados.

BEGIN;

CREATE TABLE IF NOT EXISTS message_alerts (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('pending', 'in_progress')),
  sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_message_alerts_message ON message_alerts(message_id);
CREATE INDEX IF NOT EXISTS idx_message_alerts_type ON message_alerts(alert_type);

COMMIT;
