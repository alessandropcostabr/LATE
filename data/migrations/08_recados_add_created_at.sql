BEGIN;

-- Garante tabela de meta de migrations
CREATE TABLE IF NOT EXISTS migrations_meta (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    run_on DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cria tabela temporária sem a coluna antigo "criado_em"
CREATE TABLE recados_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    descricao TEXT,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    created_by INTEGER,
    updated_by INTEGER
);

-- Copia dados migrando criado_em para created_at
INSERT INTO recados_new (id, titulo, descricao, user_id, created_at, updated_at, created_by, updated_by)
SELECT id, titulo, descricao, user_id,
       COALESCE(created_at, criado_em, CURRENT_TIMESTAMP),
       updated_at, created_by, updated_by
  FROM recados;

-- Substitui tabela antiga
DROP TABLE recados;
ALTER TABLE recados_new RENAME TO recados;

-- Recria índice
DROP INDEX IF EXISTS idx_created_at;
CREATE INDEX IF NOT EXISTS idx_created_at ON recados(created_at);

-- Registra execução da migration
INSERT INTO migrations_meta (name) VALUES ('08_recados_add_created_at');

COMMIT;
