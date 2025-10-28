-- migrations/20251201_sprint_a_artifacts.sql
-- Sprint A: estrutura para labels, checklists, comentários, watchers e automations.
-- Comentários em pt-BR explicando as decisões de schema.

BEGIN;

-- Índices adicionais para otimizar filtros no Kanban/Calendário.
CREATE INDEX IF NOT EXISTS idx_messages_callback_time ON messages(callback_time);
CREATE INDEX IF NOT EXISTS idx_messages_status_cbtime ON messages(status, callback_time DESC);

-- Tabela auxiliar para labels (tags) simples associadas aos recados.
CREATE TABLE IF NOT EXISTS message_labels (
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  PRIMARY KEY (message_id, label),
  CONSTRAINT message_labels_label_format CHECK (label ~ '^[a-z0-9\\-_.]{2,32}$')
);
CREATE INDEX IF NOT EXISTS idx_message_labels_label ON message_labels(label);

-- Checklists agrupam itens de acompanhamento por recado.
CREATE TABLE IF NOT EXISTS message_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  progress_cached SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT message_checklists_title_length CHECK (length(title) BETWEEN 1 AND 200),
  CONSTRAINT message_checklists_progress_valid CHECK (progress_cached BETWEEN 0 AND 100)
);
CREATE INDEX IF NOT EXISTS idx_checklist_message ON message_checklists(message_id);

-- Itens pertencentes a um checklist específico.
CREATE TABLE IF NOT EXISTS message_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES message_checklists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  position SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT message_checklist_items_title_length CHECK (length(title) BETWEEN 1 AND 200)
);
CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist ON message_checklist_items(checklist_id);

-- Comentários encadeados em cada recado (timeline textual).
CREATE TABLE IF NOT EXISTS message_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT message_comments_body_length CHECK (length(body) BETWEEN 1 AND 5000)
);
CREATE INDEX IF NOT EXISTS idx_message_comments_message ON message_comments(message_id);
CREATE INDEX IF NOT EXISTS idx_message_comments_created_at ON message_comments(created_at);

-- Watchers notificam usuários específicos sobre mudanças no recado.
CREATE TABLE IF NOT EXISTS message_watchers (
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_message_watchers_user ON message_watchers(user_id);

-- Automations descrevem regras dinâmicas para eventos de recados.
CREATE TABLE IF NOT EXISTS automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event TEXT NOT NULL,
  condition_json JSONB,
  action_json JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT automations_event_valid CHECK (event IN ('due_in_minutes', 'aging_hours', 'status_changed'))
);

-- Logs de execução das automations para auditoria/debug.
CREATE TABLE IF NOT EXISTS automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  error TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_automation_logs_automation ON automation_logs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_message ON automation_logs(message_id);

COMMIT;
