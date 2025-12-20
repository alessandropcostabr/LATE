-- Semente inicial CRM baseada no snapshot Salesforce (6 contas, 6 oportunidades, 5 leads)
-- Data: 13/12/2025
BEGIN;

DO $$
DECLARE
  pip_train UUID;
  pip_clinic UUID;
BEGIN
  INSERT INTO pipelines (object_type, name, requires_account, requires_contact, active)
  VALUES ('opportunity', 'Treinamentos', FALSE, TRUE, TRUE)
  ON CONFLICT (object_type, name) DO NOTHING;

  INSERT INTO pipelines (object_type, name, requires_account, requires_contact, active)
  VALUES ('opportunity', 'Clinica', FALSE, TRUE, TRUE)
  ON CONFLICT (object_type, name) DO NOTHING;

  SELECT id INTO pip_train FROM pipelines WHERE object_type = 'opportunity' AND name = 'Treinamentos' LIMIT 1;
  SELECT id INTO pip_clinic FROM pipelines WHERE object_type = 'opportunity' AND name = 'Clinica' LIMIT 1;

  -- Estágios
  INSERT INTO pipeline_stages (pipeline_id, name, position, probability, color)
  VALUES
    (pip_train, 'Qualificação', 1, 0.1, '#3b82f6'),
    (pip_train, 'Proposta',      2, 0.4, '#f59e0b'),
    (pip_train, 'Fechamento',    3, 0.8, '#10b981'),
    (pip_clinic, 'Qualificação', 1, 0.1, '#3b82f6'),
    (pip_clinic, 'Consulta',     2, 0.4, '#f472b6'),
    (pip_clinic, 'Tratamento',   3, 0.7, '#22c55e')
  ON CONFLICT (pipeline_id, position) DO NOTHING;

  -- Regras básicas
  INSERT INTO pipeline_rules (pipeline_stage_id, required_fields, forbid_jump, forbid_back)
  SELECT id, required_fields, forbid_jump, forbid_back
    FROM (
      SELECT id, '["title","contact_id"]'::jsonb AS required_fields, FALSE AS forbid_jump, FALSE AS forbid_back
        FROM pipeline_stages WHERE pipeline_id = pip_train AND position = 1
      UNION ALL
      SELECT id, '["amount","close_date"]'::jsonb, FALSE, FALSE
        FROM pipeline_stages WHERE pipeline_id = pip_train AND position = 2
      UNION ALL
      SELECT id, '["amount","close_date"]'::jsonb, TRUE, TRUE
        FROM pipeline_stages WHERE pipeline_id = pip_train AND position = 3
      UNION ALL
      SELECT id, '["title","contact_id"]'::jsonb, FALSE, FALSE
        FROM pipeline_stages WHERE pipeline_id = pip_clinic AND position = 1
      UNION ALL
      SELECT id, '["close_date"]'::jsonb, FALSE, FALSE
        FROM pipeline_stages WHERE pipeline_id = pip_clinic AND position = 2
      UNION ALL
      SELECT id, '["amount","close_date"]'::jsonb, TRUE, TRUE
        FROM pipeline_stages WHERE pipeline_id = pip_clinic AND position = 3
    ) s
  ON CONFLICT (pipeline_stage_id) DO NOTHING;
END $$;

-- Contatos
INSERT INTO contacts (id, name, phone, phone_normalized, email, email_normalized)
VALUES
  ('c1110000-0000-4000-8000-000000000001', 'Juju', '11912345678', '5511912345678', NULL, ''),
  ('c1110000-0000-4000-8000-000000000002', 'Dulce Maria Chipana Acuna', '11987654321', '5511987654321', NULL, ''),
  ('c1110000-0000-4000-8000-000000000003', 'Adriana', '11955556666', '5511955556666', NULL, ''),
  ('c1110000-0000-4000-8000-000000000004', 'Ary', '11911112222', '5511911112222', NULL, ''),
  ('c1110000-0000-4000-8000-000000000005', 'Lais Nascimento Melo', '11933334444', '5511933334444', NULL, ''),
  ('c1110000-0000-4000-8000-000000000006', 'Cris Rico', '11977778888', '5511977778888', NULL, ''),
  ('c2220000-0000-4000-8000-000000000001', 'Jaqueline Daiane', '11900001111', '5511900001111', 'jaque@example.com', 'jaque@example.com'),
  ('c2220000-0000-4000-8000-000000000002', 'Emily Maria', '11900002222', '5511900002222', 'emily@example.com', 'emily@example.com'),
  ('c2220000-0000-4000-8000-000000000003', 'Rebeca', '11900003333', '5511900003333', 'rebeca@example.com', 'rebeca@example.com'),
  ('c2220000-0000-4000-8000-000000000004', 'Ana Carolina', '11900004444', '5511900004444', 'ana@example.com', 'ana@example.com'),
  ('c2220000-0000-4000-8000-000000000005', 'Sarah Cristina', '11900005555', '5511900005555', 'sarah@example.com', 'sarah@example.com')
ON CONFLICT DO NOTHING;

-- Leads
WITH pip_train AS (
  SELECT id FROM pipelines WHERE name='Treinamentos' LIMIT 1
)
INSERT INTO leads (id, contact_id, pipeline_id, status, owner_id, source, score, notes)
SELECT * FROM (
  SELECT gen_random_uuid(), 'c2220000-0000-4000-8000-000000000001'::uuid, (SELECT id FROM pip_train), 'open', (SELECT id FROM users ORDER BY id LIMIT 1), 'salesforce', 10, NULL
  UNION ALL SELECT gen_random_uuid(), 'c2220000-0000-4000-8000-000000000002'::uuid, (SELECT id FROM pip_train), 'open', (SELECT id FROM users ORDER BY id LIMIT 1), 'salesforce', 8, NULL
  UNION ALL SELECT gen_random_uuid(), 'c2220000-0000-4000-8000-000000000003'::uuid, (SELECT id FROM pip_train), 'open', (SELECT id FROM users ORDER BY id LIMIT 1), 'salesforce', 7, NULL
  UNION ALL SELECT gen_random_uuid(), 'c2220000-0000-4000-8000-000000000004'::uuid, (SELECT id FROM pip_train), 'open', (SELECT id FROM users ORDER BY id LIMIT 1), 'salesforce', 6, NULL
  UNION ALL SELECT gen_random_uuid(), 'c2220000-0000-4000-8000-000000000005'::uuid, (SELECT id FROM pip_train), 'open', (SELECT id FROM users ORDER BY id LIMIT 1), 'salesforce', 5, NULL
) s
ON CONFLICT (contact_id) DO NOTHING;

-- Oportunidades
WITH
  pip_train AS (SELECT id FROM pipelines WHERE name='Treinamentos' LIMIT 1),
  pip_clinic AS (SELECT id FROM pipelines WHERE name='Clinica' LIMIT 1),
  stage_train AS (SELECT id FROM pipeline_stages WHERE pipeline_id = (SELECT id FROM pip_train) AND position = 1 LIMIT 1),
  stage_clinic AS (SELECT id FROM pipeline_stages WHERE pipeline_id = (SELECT id FROM pip_clinic) AND position = 1 LIMIT 1)
INSERT INTO opportunities (id, title, account_id, contact_id, pipeline_id, stage_id, amount, close_date, owner_id, source, description)
SELECT * FROM (
  SELECT gen_random_uuid(), 'Treinamento - Juju', NULL::uuid, 'c1110000-0000-4000-8000-000000000001'::uuid,
         (SELECT id FROM pip_train), (SELECT id FROM stage_train), 9000, '2025-06-30'::date, (SELECT id FROM users ORDER BY id LIMIT 1), 'salesforce', NULL
  UNION ALL
  SELECT gen_random_uuid(), 'Treinamento - Dulce Maria', NULL, 'c1110000-0000-4000-8000-000000000002'::uuid,
         (SELECT id FROM pip_train), (SELECT id FROM stage_train), 2000, '2025-08-30', (SELECT id FROM users ORDER BY id LIMIT 1), 'salesforce', NULL
  UNION ALL
  SELECT gen_random_uuid(), 'Treinamento - Adriana', NULL, 'c1110000-0000-4000-8000-000000000003'::uuid,
         (SELECT id FROM pip_train), (SELECT id FROM stage_train), 4000, '2025-09-30', (SELECT id FROM users ORDER BY id LIMIT 1), 'salesforce', NULL
  UNION ALL
  SELECT gen_random_uuid(), 'Clínica - Ary', NULL, 'c1110000-0000-4000-8000-000000000004'::uuid,
         (SELECT id FROM pip_clinic), (SELECT id FROM stage_clinic), 1500, '2025-07-15', (SELECT id FROM users ORDER BY id LIMIT 1), 'salesforce', NULL
  UNION ALL
  SELECT gen_random_uuid(), 'Clínica - Lais', NULL, 'c1110000-0000-4000-8000-000000000005'::uuid,
         (SELECT id FROM pip_clinic), (SELECT id FROM stage_clinic), 800, '2025-08-10', (SELECT id FROM users ORDER BY id LIMIT 1), 'salesforce', NULL
  UNION ALL
  SELECT gen_random_uuid(), 'Clínica - Cris Rico', NULL, 'c1110000-0000-4000-8000-000000000006'::uuid,
         (SELECT id FROM pip_clinic), (SELECT id FROM stage_clinic), 1200, '2025-09-05', (SELECT id FROM users ORDER BY id LIMIT 1), 'salesforce', NULL
) s
ON CONFLICT DO NOTHING;

COMMIT;
