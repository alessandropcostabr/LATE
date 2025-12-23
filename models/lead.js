// models/lead.js
// Leads 1:1 com contato; pipeline obrigatório.

const db = require('../config/database');
const ContactModel = require('./contact');

const DEFAULT_LIST_LIMIT = 50;

function buildFilters(filter = {}, { leadAlias = 'leads', contactAlias = 'contacts' } = {}) {
  const clauses = [];
  const params = [];
  let i = 1;

  clauses.push(`${leadAlias}.deleted_at IS NULL`);
  if (filter.pipeline_id) { clauses.push(`${leadAlias}.pipeline_id = $${i++}`); params.push(filter.pipeline_id); }
  if (filter.owner_id) { clauses.push(`${leadAlias}.owner_id = $${i++}`); params.push(filter.owner_id); }
  if (filter.status) { clauses.push(`${leadAlias}.status = $${i++}`); params.push(filter.status); }
  if (filter.search) {
    const term = `%${filter.search.toLowerCase()}%`;
    clauses.push(`(LOWER(${leadAlias}.source) LIKE $${i} OR EXISTS (SELECT 1 FROM contacts c WHERE c.id = ${leadAlias}.contact_id AND c.deleted_at IS NULL AND (LOWER(c.email) LIKE $${i} OR c.phone_normalized LIKE $${i} OR LOWER(c.name) LIKE $${i})))`);
    params.push(term);
    i += 0; // intencional: reutiliza o mesmo placeholder $i em múltiplas colunas
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return { where, params };
}

async function listLeads(filter = {}, { limit = DEFAULT_LIST_LIMIT, offset = 0 } = {}) {
  const { where, params } = buildFilters(filter, { leadAlias: 'l' });
  const sql = `
    SELECT l.*,
           c.name AS contact_name,
           c.email,
           c.phone,
           c.phone_normalized,
           c.email_normalized,
           p.name AS pipeline_name
      FROM leads l
      JOIN contacts c ON c.id = l.contact_id AND c.deleted_at IS NULL
      LEFT JOIN pipelines p ON p.id = l.pipeline_id
      ${where}
     ORDER BY l.created_at DESC
     LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
  `;
  const { rows } = await db.query(sql, [...params, limit, offset]);
  return rows || [];
}

async function createLead({ contact, contact_id = null, pipeline_id = null, owner_id = null, source = 'desconhecida', status = 'open', score = 0, notes = null }, client = null) {
  let contactRow = null;
  let contactId = contact_id || null;
  if (!contactId) {
    contactRow = await ContactModel.upsert(contact || {}, client);
    if (!contactRow) {
      throw new Error('Contato inválido para o lead');
    }
    contactId = contactRow.id;
  }

  const sql = `
    INSERT INTO leads (contact_id, pipeline_id, owner_id, source, status, score, notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (contact_id) WHERE deleted_at IS NULL DO UPDATE SET
      pipeline_id = COALESCE(EXCLUDED.pipeline_id, leads.pipeline_id),
      owner_id = COALESCE(EXCLUDED.owner_id, leads.owner_id),
      source = COALESCE(EXCLUDED.source, leads.source),
      status = COALESCE(EXCLUDED.status, leads.status),
      score = EXCLUDED.score,
      notes = COALESCE(EXCLUDED.notes, leads.notes),
      updated_at = NOW()
    RETURNING *
  `;

  const params = [
    contactId,
    pipeline_id,
    owner_id,
    source,
    status,
    score,
    notes,
  ];

  const runner = client || db;
  const { rows } = await runner.query(sql, params);
  return rows?.[0] || null;
}

async function findById(id, { includeDeleted = false } = {}) {
  const sql = `
    SELECT * FROM leads
     WHERE id = $1
       ${includeDeleted ? '' : 'AND deleted_at IS NULL'}
     LIMIT 1
  `;
  const { rows } = await db.query(sql, [id]);
  return rows?.[0] || null;
}

module.exports = {
  createLead,
  findById,
  listLeads,
};

async function updateLead(id, updates = {}, client = null) {
  if (!id) return null;
  const fields = [];
  const params = [id];
  let i = 2;

  if (Object.prototype.hasOwnProperty.call(updates, 'pipeline_id')) {
    fields.push(`pipeline_id = $${i++}`);
    params.push(updates.pipeline_id || null);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'status')) {
    fields.push(`status = $${i++}`);
    params.push(updates.status || null);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'score')) {
    fields.push(`score = $${i++}`);
    params.push(Number.isFinite(Number(updates.score)) ? Number(updates.score) : 0);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'notes')) {
    fields.push(`notes = $${i++}`);
    params.push(updates.notes || null);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'source')) {
    fields.push(`source = $${i++}`);
    params.push(updates.source || null);
  }

  if (!fields.length) return null;
  fields.push('updated_at = NOW()');

  const sql = `
    UPDATE leads
       SET ${fields.join(', ')}
     WHERE id = $1
       AND deleted_at IS NULL
     RETURNING *
  `;
  const runner = client || db;
  const { rows } = await runner.query(sql, params);
  return rows?.[0] || null;
}

async function softDelete(id, client = null) {
  if (!id) return null;
  const sql = `
    UPDATE leads
       SET deleted_at = NOW(),
           updated_at = NOW()
     WHERE id = $1
       AND deleted_at IS NULL
     RETURNING *
  `;
  const runner = client || db;
  const { rows } = await runner.query(sql, [id]);
  return rows?.[0] || null;
}

async function dependencies(id) {
  const sql = `
    SELECT
      (SELECT COUNT(*)::int FROM activities WHERE related_type = 'lead' AND related_id = $1 AND deleted_at IS NULL) AS activities
  `;
  const { rows } = await db.query(sql, [id]);
  return rows?.[0] || { activities: 0 };
}

module.exports.updateLead = updateLead;
module.exports.softDelete = softDelete;
module.exports.dependencies = dependencies;
