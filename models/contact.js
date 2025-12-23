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
    deleted_at: row.deleted_at ?? null,
  };
}

function buildLookup({ phone, email } = {}) {
  const phoneNormalized = normalizePhone(phone) || '';
  const emailNormalized = normalizeEmail(email) || '';
  if (!phoneNormalized && !emailNormalized) return null;
  return { phoneNormalized, emailNormalized };
}

function normalizeName(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

async function upsert(contactInput = {}, client = null) {
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
    ON CONFLICT (email_normalized, phone_normalized) WHERE deleted_at IS NULL
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

  const runner = client || db;
  const { rows } = await runner.query(sql, params);
  return mapRow(rows?.[0]);
}

async function updateFromMessage(message = {}, client = null) {
  const input = {
    name: message.sender_name ?? message.senderName ?? null,
    phone: message.sender_phone ?? message.senderPhone ?? null,
    email: message.sender_email ?? message.senderEmail ?? null,
  };
  return upsert(input, client);
}

async function findById(contactId, { includeDeleted = false } = {}, client = null) {
  if (!contactId) return null;
  const sql = `
    SELECT * FROM contacts
     WHERE id = $1
       ${includeDeleted ? '' : 'AND deleted_at IS NULL'}
     LIMIT 1
  `;
  const runner = client || db;
  const { rows } = await runner.query(sql, [contactId]);
  return mapRow(rows?.[0]);
}

async function findByIdentifiers({ phone, email } = {}, client = null) {
  const lookup = buildLookup({ phone, email });
  if (!lookup) return null;
  const sql = `
    SELECT *
      FROM contacts
     WHERE email_normalized = $1
       AND phone_normalized = $2
       AND deleted_at IS NULL
     LIMIT 1
  `;
  const runner = client || db;
  const { rows } = await runner.query(sql, [lookup.emailNormalized, lookup.phoneNormalized]);
  return mapRow(rows?.[0]);
}

async function findByAnyIdentifier({ phone, email } = {}, client = null) {
  const lookup = buildLookup({ phone, email });
  if (!lookup) return null;
  const clauses = [];
  const params = [];
  let i = 1;
  if (lookup.emailNormalized) {
    clauses.push(`email_normalized = $${i++}`);
    params.push(lookup.emailNormalized);
  }
  if (lookup.phoneNormalized) {
    clauses.push(`phone_normalized = $${i++}`);
    params.push(lookup.phoneNormalized);
  }
  if (!clauses.length) return null;
  const sql = `
    SELECT *
      FROM contacts
     WHERE (${clauses.join(' OR ')})
       AND deleted_at IS NULL
     ORDER BY updated_at DESC
     LIMIT 1
  `;
  const runner = client || db;
  const { rows } = await runner.query(sql, params);
  return mapRow(rows?.[0]);
}

async function updateById(contactId, { name, phone, email } = {}, client = null) {
  if (!contactId) return null;
  const normalizedName = normalizeName(name);
  const normalizedPhone = normalizePhone(phone);
  const normalizedEmail = normalizeEmail(email);
  const sql = `
    UPDATE contacts
       SET name = COALESCE($2, name),
           phone = COALESCE($3, phone),
           email = COALESCE($4, email),
           phone_normalized = COALESCE($5, phone_normalized),
           email_normalized = COALESCE($6, email_normalized),
           updated_at = NOW()
     WHERE id = $1
       AND deleted_at IS NULL
     RETURNING *
  `;
  const params = [
    contactId,
    normalizedName,
    normalizedPhone,
    normalizedEmail,
    normalizedPhone,
    normalizedEmail,
  ];
  const runner = client || db;
  const { rows } = await runner.query(sql, params);
  return mapRow(rows?.[0]);
}

async function touch(contactInput = {}) {
  return upsert(contactInput);
}

module.exports = {
  upsert,
  touch,
  updateFromMessage,
  findById,
  findByIdentifiers,
  findByAnyIdentifier,
  updateById,
  mapRow,
};


async function findDuplicates({ limit = 50 } = {}) {
  const sql = `
    SELECT phone_normalized, email_normalized, array_agg(id) AS ids, COUNT(*) AS total
      FROM contacts
     WHERE deleted_at IS NULL
       AND (phone_normalized <> '' OR email_normalized <> '')
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
  // Marca contato duplicado como removido
  await db.query('UPDATE contacts SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL', [sourceId]);
  return true;
}

module.exports.findDuplicates = findDuplicates;
module.exports.mergeContacts = mergeContacts;

async function softDelete(contactId, client = null) {
  if (!contactId) return null;
  const sql = `
    UPDATE contacts
       SET deleted_at = NOW(),
           updated_at = NOW()
     WHERE id = $1
       AND deleted_at IS NULL
     RETURNING *
  `;
  const runner = client || db;
  const { rows } = await runner.query(sql, [contactId]);
  return mapRow(rows?.[0]);
}

async function dependencies(contactId) {
  const sql = `
    SELECT
      (SELECT COUNT(*)::int FROM leads WHERE contact_id = $1 AND deleted_at IS NULL) AS leads,
      (SELECT COUNT(*)::int FROM opportunities WHERE contact_id = $1 AND deleted_at IS NULL) AS opportunities,
      (SELECT COUNT(*)::int FROM activities WHERE related_type = 'contact' AND related_id = $1 AND deleted_at IS NULL) AS activities
  `;
  const { rows } = await db.query(sql, [contactId]);
  return rows?.[0] || { leads: 0, opportunities: 0, activities: 0 };
}

async function isOwnedBy(contactId, userId) {
  if (!contactId || !userId) return false;
  const sql = `
    SELECT
      EXISTS(SELECT 1 FROM leads WHERE contact_id = $1 AND owner_id = $2 AND deleted_at IS NULL)
      OR EXISTS(SELECT 1 FROM opportunities WHERE contact_id = $1 AND owner_id = $2 AND deleted_at IS NULL)
      OR EXISTS(SELECT 1 FROM activities WHERE related_type = 'contact' AND related_id = $1 AND owner_id = $2 AND deleted_at IS NULL)
      AS allowed
  `;
  const { rows } = await db.query(sql, [contactId, userId]);
  return rows?.[0]?.allowed === true;
}

module.exports.softDelete = softDelete;
module.exports.dependencies = dependencies;
module.exports.isOwnedBy = isOwnedBy;
