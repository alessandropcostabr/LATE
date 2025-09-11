-- 08_recados_add_created_at.sql
-- Renomeia a coluna "criado_em" para "created_at" e cria o índice correspondente.

BEGIN;
ALTER TABLE recados RENAME COLUMN criado_em TO created_at;

-- Rollback:
ALTER TABLE recados RENAME COLUMN created_at TO criado_em;
DROP INDEX IF EXISTS idx_created_at;
DELETE FROM migrations_meta WHERE name = '08_recados_add_created_at';