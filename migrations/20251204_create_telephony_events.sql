-- Cria tabela para eventos de telefonia (Asterisk -> LATE)
-- Idempotência: unique (uniqueid, state)

CREATE TABLE IF NOT EXISTS telephony_events (
  id          BIGSERIAL PRIMARY KEY,
  uniqueid    TEXT NOT NULL,
  event       TEXT NOT NULL,
  state       TEXT,
  caller      TEXT,
  callee      TEXT,
  trunk       TEXT,
  start_ts    TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload     JSONB
);

CREATE UNIQUE INDEX IF NOT EXISTS telephony_events_uniqueid_state_idx
  ON telephony_events (uniqueid, state);

CREATE INDEX IF NOT EXISTS telephony_events_caller_idx ON telephony_events (caller);
CREATE INDEX IF NOT EXISTS telephony_events_callee_idx ON telephony_events (callee);
CREATE INDEX IF NOT EXISTS telephony_events_start_ts_idx ON telephony_events (start_ts);
