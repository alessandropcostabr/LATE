// models/contact.js
// Persistência da entidade contacts (interna, invisível ao usuário).

const db = require('../config/database');
const {
  normalizeContactPayload,
  normalizeEmail,
  normalizePhone,
} = require('../utils/normalizeContact');

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    phone_normalized: row.phone_normalized ?? '',
    email_normalized: row.email_normalized ?? '',
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

function buildLookup({ phone, email } = {}) {
  const phoneNormalized = normalizePhone(phone) || '';
  const emailNormalized = normalizeEmail(email) || '';
  if (!phoneNormalized && !emailNormalized) return null;
  return { phoneNormalized, emailNormalized };
}

async function upsert(contactInput = {}) {
  const normalized = normalizeContactPayload(contactInput);
  if (!normalized) return null;

  const {
    name,
    phone,
    email,
    phoneNormalized,
    emailNormalized,
  } = normalized;

  const sql = `
    INSERT INTO contacts (
      name,
      phone,
      email,
      phone_normalized,
      email_normalized
    )
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (email_normalized, phone_normalized)
    DO UPDATE SET
      name = COALESCE(EXCLUDED.name, contacts.name),
      phone = COALESCE(NULLIF(EXCLUDED.phone, ''), contacts.phone),
      email = COALESCE(NULLIF(EXCLUDED.email, ''), contacts.email),
      updated_at = NOW()
    RETURNING *
  `;

  const params = [
    name,
    phone || null,
    email || null,
    phoneNormalized,
    emailNormalized,
  ];

  const { rows } = await db.query(sql, params);
  return mapRow(rows?.[0]);
}

async function updateFromMessage(message = {}) {
  const input = {
    name: message.sender_name ?? message.senderName ?? null,
    phone: message.sender_phone ?? message.senderPhone ?? null,
    email: message.sender_email ?? message.senderEmail ?? null,
  };
  return upsert(input);
}

async function findByIdentifiers({ phone, email } = {}) {
  const lookup = buildLookup({ phone, email });
  if (!lookup) return null;
  const sql = `
    SELECT *
      FROM contacts
     WHERE email_normalized = $1
       AND phone_normalized = $2
     LIMIT 1
  `;
  const { rows } = await db.query(sql, [lookup.emailNormalized, lookup.phoneNormalized]);
  return mapRow(rows?.[0]);
}

async function touch(contactInput = {}) {
  return upsert(contactInput);
}

module.exports = {
  upsert,
  touch,
  updateFromMessage,
  findByIdentifiers,
  mapRow,
};


async function findDuplicates({ limit = 50 } = {}) {
  const sql = `
    SELECT phone_normalized, email_normalized, array_agg(id) AS ids, COUNT(*) AS total
      FROM contacts
     WHERE (phone_normalized <> '' OR email_normalized <> '')
     GROUP BY phone_normalized, email_normalized
    HAVING COUNT(*) > 1
     ORDER BY total DESC
     LIMIT $1`;
  const { rows } = await db.query(sql, [limit]);
  return rows || [];
}

async function mergeContacts(sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) return false;
  // Reatribui relacionamentos
  await db.query('UPDATE leads SET contact_id = $2 WHERE contact_id = $1', [sourceId, targetId]);
  await db.query('UPDATE opportunities SET contact_id = $2 WHERE contact_id = $1', [sourceId, targetId]);
  await db.query("UPDATE activities SET related_id = $2 WHERE related_type = 'contact' AND related_id = $1", [sourceId, targetId]);
  // Remove contato duplicado
  await db.query('DELETE FROM contacts WHERE id = $1', [sourceId]);
  return true;
}

module.exports.findDuplicates = findDuplicates;
module.exports.mergeContacts = mergeContacts;
