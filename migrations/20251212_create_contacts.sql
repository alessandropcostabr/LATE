-- Sprint D — Relacionamento
-- Cria tabela contacts e realiza backfill inicial a partir dos registros existentes.

BEGIN;

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  phone TEXT,
  email TEXT,
  phone_normalized TEXT NOT NULL DEFAULT '',
  email_normalized TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_email_phone_unique
  ON contacts (email_normalized, phone_normalized);

CREATE INDEX IF NOT EXISTS idx_contacts_phone_normalized
  ON contacts (phone_normalized)
  WHERE phone_normalized IS NOT NULL AND phone_normalized <> '';

CREATE INDEX IF NOT EXISTS idx_contacts_email_normalized
  ON contacts (email_normalized)
  WHERE email_normalized IS NOT NULL AND email_normalized <> '';

WITH source AS (
  SELECT
    NULLIF(TRIM(sender_name), '') AS name,
    NULLIF(TRIM(sender_phone), '') AS phone,
    NULLIF(LOWER(TRIM(sender_email)), '') AS email,
    COALESCE(regexp_replace(COALESCE(sender_phone, ''), '[^0-9]+', '', 'g'), '') AS phone_normalized,
    COALESCE(LOWER(TRIM(sender_email)), '') AS email_normalized
  FROM messages
),
prepared AS (
  SELECT DISTINCT ON (COALESCE(email_normalized, ''), COALESCE(phone_normalized, ''))
    name,
    phone,
    email,
    phone_normalized,
    email_normalized
  FROM source
  WHERE email_normalized <> '' OR phone_normalized <> ''
  ORDER BY COALESCE(email_normalized, ''), COALESCE(phone_normalized, ''), name NULLS LAST
)
INSERT INTO contacts (name, phone, email, phone_normalized, email_normalized)
SELECT name, phone, email, phone_normalized, email_normalized
FROM prepared;

COMMIT;
