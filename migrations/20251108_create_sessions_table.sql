-- Cria tabela de sessões compatível com connect-pg-simple.
-- Mantém o armazenamento em JSON (coluna sess) e índice por expiração.

BEGIN;

CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  sess JSONB NOT NULL,
  expire TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions (expire);

COMMIT;
