-- Migração para criar a tabela `messages` no formato em inglês.
-- Remove a tabela antiga `recados` (caso exista) e cria a nova estrutura
-- com colunas e enum de status em inglês. Não afeta a tabela `users`.

PRAGMA foreign_keys=OFF;

-- Remover a tabela antiga de recados, se ainda existir
DROP TABLE IF EXISTS recados;

-- Criar a nova tabela messages
CREATE TABLE IF NOT EXISTS messages (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    call_date     TEXT NOT NULL,
    call_time     TEXT NOT NULL,
    recipient     TEXT NOT NULL,
    sender_name   TEXT NOT NULL,
    sender_phone  TEXT,
    sender_email  TEXT,
    subject       TEXT NOT NULL,
    message       TEXT NOT NULL,
    status        TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','resolved')),
    callback_time TEXT,
    notes         TEXT,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

PRAGMA foreign_keys=ON;
