-- 08_recados_add_created_at.sql
-- Adiciona coluna created_at se não existir, migra dados de criado_em e recria índice.
ALTER TABLE recados ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;
UPDATE recados SET created_at = COALESCE(created_at, criado_em, CURRENT_TIMESTAMP);
ALTER TABLE recados DROP COLUMN criado_em;
DROP INDEX IF EXISTS idx_created_at;
CREATE INDEX IF NOT EXISTS idx_created_at ON recados(created_at);
