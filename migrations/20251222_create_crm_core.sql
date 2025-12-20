-- LATE CRM core schema (pipelines, stages, rules, accounts, leads, opportunities, activities, labels, custom fields)
-- Data de criação: 12/12/2025

BEGIN;

-- Pipelines e estágios (configuráveis)
CREATE TABLE IF NOT EXISTS pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type TEXT NOT NULL CHECK (object_type IN ('opportunity')),
  name TEXT NOT NULL,
  requires_account BOOLEAN NOT NULL DEFAULT FALSE,
  requires_contact BOOLEAN NOT NULL DEFAULT TRUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pipelines_object_name_unique UNIQUE (object_type, name)
);

CREATE TABLE IF NOT EXISTS pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  probability NUMERIC(5,2) NOT NULL DEFAULT 0,
  color TEXT DEFAULT '#64748b',
  sla_minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pipeline_stages_position_unique UNIQUE (pipeline_id, position),
  CONSTRAINT pipeline_stages_name_unique UNIQUE (pipeline_id, name),
  CONSTRAINT pipeline_stages_probability_range CHECK (probability >= 0 AND probability <= 1)
);

CREATE TABLE IF NOT EXISTS pipeline_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,
  required_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  forbid_jump BOOLEAN NOT NULL DEFAULT FALSE,
  forbid_back BOOLEAN NOT NULL DEFAULT FALSE,
  auto_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pipeline_rules_stage_unique UNIQUE (pipeline_stage_id)
);

-- Contas (opcionais) e contatos já existem (contacts)
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  phone_normalized TEXT NOT NULL DEFAULT '',
  email TEXT,
  email_normalized TEXT NOT NULL DEFAULT '',
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_accounts_phone_normalized ON accounts (phone_normalized) WHERE phone_normalized <> '';
CREATE INDEX IF NOT EXISTS idx_accounts_email_normalized ON accounts (email_normalized) WHERE email_normalized <> '';

-- Leads (1:1 com contato)
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open',
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  source TEXT DEFAULT 'desconhecida',
  score INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT leads_contact_unique UNIQUE (contact_id)
);

-- Oportunidades
CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE RESTRICT,
  stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) DEFAULT 0,
  close_date DATE,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  source TEXT DEFAULT 'desconhecida',
  probability_override NUMERIC(5,2),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON opportunities (pipeline_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_owner ON opportunities (owner_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_close_date ON opportunities (close_date);
CREATE INDEX IF NOT EXISTS idx_opportunities_contact ON opportunities (contact_id);

-- Atividades / compromissos
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('task','meeting','call')),
  subject TEXT NOT NULL,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  related_type TEXT CHECK (related_type IN ('lead','contact','account','opportunity')),
  related_id UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_owner_status ON activities (owner_id, status);
CREATE INDEX IF NOT EXISTS idx_activities_related ON activities (related_type, related_id);
CREATE INDEX IF NOT EXISTS idx_activities_starts_at ON activities (starts_at);

-- Labels genéricas
CREATE TABLE IF NOT EXISTS labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#0ea5e9',
  scope TEXT NOT NULL CHECK (scope IN ('lead','contact','account','opportunity')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT labels_scope_name_unique UNIQUE (scope, name)
);

CREATE TABLE IF NOT EXISTS label_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('lead','contact','account','opportunity')),
  entity_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT label_links_unique UNIQUE (label_id, entity_type, entity_id)
);

-- Campanhas (leve)
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  budget NUMERIC(12,2) DEFAULT 0,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Campos customizados
CREATE TABLE IF NOT EXISTS custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity TEXT NOT NULL CHECK (entity IN ('lead','contact','account','opportunity','activity')),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT custom_fields_entity_name_unique UNIQUE (entity, name)
);

CREATE TABLE IF NOT EXISTS custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('lead','contact','account','opportunity','activity')),
  entity_id UUID NOT NULL,
  value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT custom_field_values_unique UNIQUE (field_id, entity_type, entity_id)
);

-- Anexos genéricos (opcional)
CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('lead','contact','account','opportunity','activity')),
  entity_id UUID NOT NULL,
  filename TEXT NOT NULL,
  url TEXT NOT NULL,
  size BIGINT DEFAULT 0,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auditoria simples
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  diff JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seeds de pipelines iniciais (Treinamentos e Clínica)
WITH pipelines_seed AS (
  INSERT INTO pipelines (object_type, name, requires_account, requires_contact, active)
  VALUES
    ('opportunity', 'Treinamentos', FALSE, TRUE, TRUE),
    ('opportunity', 'Clinica', FALSE, TRUE, TRUE)
  ON CONFLICT (object_type, name) DO UPDATE SET active = EXCLUDED.active
  RETURNING id, name
),
training AS (
  SELECT id FROM pipelines_seed WHERE name = 'Treinamentos'
),
clinic AS (
  SELECT id FROM pipelines_seed WHERE name = 'Clinica'
),
training_stages AS (
  INSERT INTO pipeline_stages (pipeline_id, name, position, probability, color)
  SELECT t.id, x.name, x.pos, x.prob, x.color
  FROM training t
  CROSS JOIN (VALUES
    ('Lead', 1, 0.10, '#c7d2fe'),
    ('Checar Turma', 2, 0.20, '#bfdbfe'),
    ('Proposta Curso', 3, 0.50, '#93c5fd'),
    ('Matrícula', 4, 0.70, '#60a5fa'),
    ('Pago', 5, 1.00, '#2563eb'),
    ('Pós', 6, 1.00, '#1d4ed8')
  ) AS x(name, pos, prob, color)
  ON CONFLICT (pipeline_id, name) DO UPDATE SET probability = EXCLUDED.probability
  RETURNING id, name
),
clinic_stages AS (
  INSERT INTO pipeline_stages (pipeline_id, name, position, probability, color)
  SELECT c.id, x.name, x.pos, x.prob, x.color
  FROM clinic c
  CROSS JOIN (VALUES
    ('Recado', 1, 0.05, '#fde68a'),
    ('Triagem', 2, 0.25, '#fcd34d'),
    ('Agendamento', 3, 0.60, '#f59e0b'),
    ('Atendido', 4, 1.00, '#d97706'),
    ('Retorno', 5, 1.00, '#b45309')
  ) AS x(name, pos, prob, color)
  ON CONFLICT (pipeline_id, name) DO UPDATE SET probability = EXCLUDED.probability
  RETURNING id, name
),
training_rules AS (
  INSERT INTO pipeline_rules (pipeline_stage_id, required_fields, forbid_jump, forbid_back, auto_actions)
  SELECT s.id, x.required_fields, x.forbid_jump, x.forbid_back, x.auto_actions
  FROM training_stages s
  JOIN LATERAL (
    SELECT
      CASE s.name
        WHEN 'Proposta Curso' THEN jsonb_build_array('amount','close_date','course_id','class_id','modality')
        WHEN 'Matrícula' THEN jsonb_build_array('payment_method')
        WHEN 'Pago' THEN jsonb_build_array('payment_method')
        ELSE '[]'::jsonb
      END AS required_fields,
      FALSE AS forbid_jump,
      CASE WHEN s.name IN ('Pago','Pós') THEN TRUE ELSE FALSE END AS forbid_back,
      CASE s.name
        WHEN 'Lead' THEN jsonb_build_array(jsonb_build_object('action','create_task','subject','Responder lead','due_in_minutes',15))
        ELSE '[]'::jsonb
      END AS auto_actions
  ) x ON TRUE
  ON CONFLICT (pipeline_stage_id) DO UPDATE SET required_fields = EXCLUDED.required_fields
  RETURNING 1
),
clinic_rules AS (
  INSERT INTO pipeline_rules (pipeline_stage_id, required_fields, forbid_jump, forbid_back, auto_actions)
  SELECT s.id, x.required_fields, x.forbid_jump, x.forbid_back, x.auto_actions
  FROM clinic_stages s
  JOIN LATERAL (
    SELECT
      CASE s.name
        WHEN 'Agendamento' THEN jsonb_build_array('appointment_slot')
        WHEN 'Atendido' THEN jsonb_build_array('outcome')
        WHEN 'Retorno' THEN jsonb_build_array('follow_up_at')
        ELSE '[]'::jsonb
      END AS required_fields,
      FALSE AS forbid_jump,
      CASE WHEN s.name IN ('Atendido','Retorno') THEN TRUE ELSE FALSE END AS forbid_back,
      CASE s.name
        WHEN 'Recado' THEN jsonb_build_array(jsonb_build_object('action','create_task','subject','Responder recado','due_in_minutes',15))
        ELSE '[]'::jsonb
      END AS auto_actions
  ) x ON TRUE
  ON CONFLICT (pipeline_stage_id) DO UPDATE SET required_fields = EXCLUDED.required_fields
  RETURNING 1
)
SELECT 1;

COMMIT;
