CREATE TABLE IF NOT EXISTS message_send_events (
  id SERIAL PRIMARY KEY,
  source VARCHAR(50) NOT NULL,
  session_id VARCHAR(255),
  arquivo VARCHAR(255),
  phone_e164 VARCHAR(30),
  nome VARCHAR(255),
  status VARCHAR(30) NOT NULL,
  mensagem_final TEXT,
  failure_reason TEXT,
  template_id VARCHAR(100),
  enviado_em TIMESTAMPTZ,
  sender_version VARCHAR(50),
  lead_data_hash VARCHAR(255),
  contexto_versao VARCHAR(20),
  api_payload_version VARCHAR(20),
  idempotency_key VARCHAR(255) NOT NULL,
  payload_raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_send_events_source_idem
  ON message_send_events (source, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_message_send_events_phone_created_at
  ON message_send_events (phone_e164, created_at);

CREATE INDEX IF NOT EXISTS idx_message_send_events_source_status_created_at
  ON message_send_events (source, status, created_at);
