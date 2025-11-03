-- migrations/20251211_update_intake_logs_token_hash.sql
-- Remove armazenamento de token em texto claro e utiliza hash.

BEGIN;

ALTER TABLE intake_logs
  ADD COLUMN IF NOT EXISTS token_hash TEXT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'digest') THEN
    UPDATE intake_logs
       SET token_hash = encode(digest(COALESCE(token, '')::text, 'sha256'), 'hex')
     WHERE token_hash IS NULL AND token IS NOT NULL;
  ELSE
    RAISE NOTICE 'Função digest indisponível; registros antigos permanecerão sem token_hash.';
  END IF;
END$$;

ALTER TABLE intake_logs
  DROP COLUMN IF EXISTS token;

COMMIT;
