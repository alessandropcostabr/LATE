-- Renomeia colunas existentes para novo padrão
ALTER TABLE users RENAME COLUMN nome TO name;
ALTER TABLE users RENAME COLUMN senha TO password_hash;
ALTER TABLE users RENAME COLUMN criado_em TO created_at;

-- Novas colunas para controle de acesso e auditoria
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'OPERADOR' CHECK (role IN ('ADMIN','SUPERVISOR','OPERADOR','LEITOR'));
ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;

-- Índices atualizados
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
