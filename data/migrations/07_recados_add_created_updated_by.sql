-- 07_recados_add_created_updated_by.sql
-- Adiciona created_by e updated_by em recados + índices.
-- Observação: Em produção você já aplicou manualmente; este arquivo é para alinhar outros ambientes.

BEGIN;
ALTER TABLE recados ADD COLUMN created_by INTEGER;
ALTER TABLE recados ADD COLUMN updated_by INTEGER;

CREATE INDEX IF NOT EXISTS idx_recados_created_by ON recados(created_by);
CREATE INDEX IF NOT EXISTS idx_recados_updated_by ON recados(updated_by);
COMMIT;
