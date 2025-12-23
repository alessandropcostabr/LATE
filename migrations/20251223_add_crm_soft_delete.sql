-- Soft delete para CRM (leads, contatos, oportunidades, atividades) + índices parciais
-- Data: 23/12/2025

BEGIN;

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_contact_unique;
DROP INDEX IF EXISTS idx_contacts_email_phone_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_email_phone_unique_active
  ON contacts (email_normalized, phone_normalized)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_contact_unique_active
  ON leads (contact_id)
  WHERE deleted_at IS NULL;

DROP MATERIALIZED VIEW IF EXISTS mv_crm_pipeline_stage_month;
DROP MATERIALIZED VIEW IF EXISTS mv_crm_activities_owner_status;

CREATE MATERIALIZED VIEW mv_crm_pipeline_stage_month AS
SELECT date_trunc('month', o.created_at)::date AS month,
       o.pipeline_id,
       o.stage_id,
       COUNT(o.id)::int AS total
  FROM opportunities o
 WHERE o.deleted_at IS NULL
 GROUP BY 1,2,3;

CREATE INDEX IF NOT EXISTS idx_mv_crm_pipeline_stage_month ON mv_crm_pipeline_stage_month (month, pipeline_id, stage_id);

CREATE MATERIALIZED VIEW mv_crm_activities_owner_status AS
SELECT owner_id,
       status,
       COUNT(id)::int AS total
  FROM activities
 WHERE deleted_at IS NULL
 GROUP BY owner_id, status;

CREATE INDEX IF NOT EXISTS idx_mv_crm_activities_owner_status ON mv_crm_activities_owner_status (owner_id, status);

COMMIT;
