-- Garante unicidade de (source, idempotency_key) em message_send_events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'message_send_events_source_idem_key'
       AND conrelid = 'message_send_events'::regclass
  ) THEN
    ALTER TABLE message_send_events
      ADD CONSTRAINT message_send_events_source_idem_key
      UNIQUE (source, idempotency_key);
  END IF;
END$$;
