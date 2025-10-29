-- migrations/20251205_notifications_intake.sql
-- Sprint C: fila de e-mails (backoff) e auditoria do intake.

BEGIN;

CREATE TABLE IF NOT EXISTS email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_json JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_run_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_queue_status_next ON email_queue(status, COALESCE(next_run_at, TIMESTAMPTZ 'epoch'));

CREATE TABLE IF NOT EXISTS intake_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
  token TEXT,
  payload JSONB,
  ip TEXT,
  user_agent TEXT,
  status TEXT NOT NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
