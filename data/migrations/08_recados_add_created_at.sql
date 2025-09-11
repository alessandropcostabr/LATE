-- 08_recados_add_created_at.sql
-- Renomeia coluna legado criado_em para created_at, caso exista, e garante índice.
ALTER TABLE recados RENAME COLUMN criado_em TO created_at;
DROP INDEX IF EXISTS idx_created_at;
CREATE INDEX IF NOT EXISTS idx_created_at ON recados(created_at);
