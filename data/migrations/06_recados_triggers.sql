-- 06_recados_triggers.sql
-- Mantém created_at/updated_at automaticamente em recados.

BEGIN;

-- Define created_at se vier nulo no INSERT
CREATE TRIGGER IF NOT EXISTS recados_set_created_at
AFTER INSERT ON recados
FOR EACH ROW
WHEN NEW.created_at IS NULL
BEGIN
  UPDATE recados
     SET created_at = CURRENT_TIMESTAMP
   WHERE id = NEW.id;
END;

-- Atualiza updated_at a cada UPDATE
CREATE TRIGGER IF NOT EXISTS recados_set_updated_at
AFTER UPDATE ON recados
FOR EACH ROW
BEGIN
  UPDATE recados
     SET updated_at = CURRENT_TIMESTAMP
   WHERE id = NEW.id;
END;

COMMIT;

-- Rollback:
-- DROP TRIGGER IF EXISTS recados_set_created_at;
-- DROP TRIGGER IF EXISTS recados_set_updated_at;
