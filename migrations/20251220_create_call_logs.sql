-- Sprint 2 – Integração Asterisk -> LATE
-- Cria tabela call_logs e marca telephony_events como processados.

BEGIN;

ALTER TABLE telephony_events
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processed_error TEXT;

CREATE TABLE IF NOT EXISTS call_logs (
  id                BIGSERIAL PRIMARY KEY,
  uniqueid          TEXT NOT NULL,
  direction         TEXT NOT NULL DEFAULT 'inbound',
  status            TEXT,
  caller            TEXT,
  caller_normalized TEXT,
  callee            TEXT,
  trunk             TEXT,
  started_at        TIMESTAMPTZ,
  ended_at          TIMESTAMPTZ,
  duration_seconds  INTEGER,
  recording         TEXT,
  payload           JSONB,
  customer_id       UUID REFERENCES contacts(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS call_logs_uniqueid_idx ON call_logs (uniqueid);
CREATE INDEX IF NOT EXISTS call_logs_caller_normalized_idx ON call_logs (caller_normalized);
CREATE INDEX IF NOT EXISTS call_logs_started_at_idx ON call_logs (started_at);

COMMIT;
