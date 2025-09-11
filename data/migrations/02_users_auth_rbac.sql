-- 02_users_auth_rbac.sql
-- Alinha nomes e adiciona colunas para autenticação moderna e RBAC.

BEGIN;

-- Renomeia colunas legadas
ALTER TABLE users RENAME COLUMN nome      TO name;
ALTER TABLE users RENAME COLUMN senha     TO password_hash;
ALTER TABLE users RENAME COLUMN criado_em TO created_at;

-- Novas colunas (DEFAULTs precisam ser constantes no ADD COLUMN)
ALTER TABLE users ADD COLUMN role      TEXT    NOT NULL DEFAULT 'OPERADOR' CHECK (role IN ('ADMIN','SUPERVISOR','OPERADOR','LEITOR'));
ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;

-- ❌ NÃO pode: ALTER ... ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;
-- ✅ Pode: adicionar sem default e depois backfill
ALTER TABLE users ADD COLUMN updated_at DATETIME;

-- Backfill (preenche valores existentes)
UPDATE users SET updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP);

-- Índices
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email     ON users(email);
CREATE INDEX        IF NOT EXISTS idx_users_role      ON users(role);
CREATE INDEX        IF NOT EXISTS idx_users_is_active ON users(is_active);

COMMIT;

-- Rollback:
-- ALTER TABLE users RENAME COLUMN name TO nome;
-- ALTER TABLE users RENAME COLUMN password_hash TO senha;
-- ALTER TABLE users RENAME COLUMN created_at TO criado_em;
-- ALTER TABLE users DROP COLUMN role;
-- ALTER TABLE users DROP COLUMN is_active;
-- ALTER TABLE users DROP COLUMN updated_at;
-- DROP INDEX IF EXISTS idx_users_email;
-- DROP INDEX IF EXISTS idx_users_role;
-- DROP INDEX IF EXISTS idx_users_is_active;
