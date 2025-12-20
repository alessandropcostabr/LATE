-- Ajusta idempotência para incluir o tipo de evento (evita colisão de Hangup/DialEnd com Newstate)

BEGIN;

DROP INDEX IF EXISTS telephony_events_uniqueid_state_idx;
CREATE UNIQUE INDEX IF NOT EXISTS telephony_events_uniqueid_event_idx
  ON telephony_events (uniqueid, event);

COMMIT;
