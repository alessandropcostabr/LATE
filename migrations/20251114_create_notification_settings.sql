-- migrations/20251114_create_notification_settings.sql
-- Configurações globais para notificações automáticas.

BEGIN;

CREATE TABLE IF NOT EXISTS notification_settings (
  id SERIAL PRIMARY KEY,
  pending_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  pending_interval_hours INTEGER NOT NULL DEFAULT 24,
  in_progress_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  in_progress_interval_hours INTEGER NOT NULL DEFAULT 48,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO notification_settings (pending_enabled, pending_interval_hours, in_progress_enabled, in_progress_interval_hours)
SELECT TRUE, 24, TRUE, 48
WHERE NOT EXISTS (SELECT 1 FROM notification_settings);

COMMIT;
