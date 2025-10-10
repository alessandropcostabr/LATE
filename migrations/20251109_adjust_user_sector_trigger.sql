-- migrations/20251109_adjust_user_sector_trigger.sql
-- Ajusta a função check_user_min_one_sector para permitir excluir usuários
-- desde que não haja recados associados.

BEGIN;

CREATE OR REPLACE FUNCTION check_user_min_one_sector()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id INTEGER;
BEGIN
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);

  IF EXISTS (SELECT 1 FROM users WHERE id = v_user_id) THEN
    IF NOT EXISTS (SELECT 1 FROM user_sectors us WHERE us.user_id = v_user_id) THEN
      RAISE EXCEPTION 'Usuário precisa estar associado a pelo menos um setor'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMIT;
