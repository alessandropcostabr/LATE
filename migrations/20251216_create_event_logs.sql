BEGIN;

CREATE TABLE IF NOT EXISTS event_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  actor_user_id INTEGER REFERENCES users(id),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_logs_type
  ON event_logs (event_type);

CREATE INDEX IF NOT EXISTS idx_event_logs_entity
  ON event_logs (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_event_logs_created_at
  ON event_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_logs_actor
  ON event_logs (actor_user_id)
  WHERE actor_user_id IS NOT NULL;

COMMIT;
