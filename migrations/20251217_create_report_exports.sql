BEGIN;

CREATE TABLE report_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  export_type TEXT NOT NULL CHECK (export_type IN ('event_logs', 'messages')),
  format TEXT NOT NULL CHECK (format IN ('csv', 'json')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_path TEXT,
  file_name TEXT,
  file_size BIGINT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX idx_report_exports_created_by ON report_exports (created_by);
CREATE INDEX idx_report_exports_status ON report_exports (status);
CREATE INDEX idx_report_exports_type ON report_exports (export_type);
CREATE INDEX idx_report_exports_expires_at ON report_exports (expires_at);

COMMIT;
