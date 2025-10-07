-- migrations/20251006b_seed_general_sector.sql
-- Cria (se não existir) o setor "Geral" e associa TODOS os usuários a ele (idempotente).

BEGIN;

-- 1) Tenta inserir "Geral" apenas se não existir (usando CTE, sem ON CONFLICT em expressão)
WITH ins AS (
  INSERT INTO sectors (name, email, is_active)
  SELECT 'Geral', NULL, TRUE
  WHERE NOT EXISTS (SELECT 1 FROM sectors WHERE LOWER(name) = 'geral')
  RETURNING id
),
-- 2) Resolve o id do setor "Geral" a partir do existente ou do recém-criado
s AS (
  SELECT id FROM sectors WHERE LOWER(name) = 'geral'
  UNION ALL
  SELECT id FROM ins
)
-- 3) Associa todos os usuários ao "Geral"; se já tiver vínculo, ignora
INSERT INTO user_sectors (user_id, sector_id)
SELECT u.id, (SELECT id FROM s LIMIT 1)
FROM users u
ON CONFLICT (user_id, sector_id) DO NOTHING;

COMMIT;

