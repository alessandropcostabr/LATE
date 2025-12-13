// models/lead.js
// Leads 1:1 com contato; pipeline opcional.

const db = require('../config/database');
const ContactModel = require('./contact');

function buildFilters(filter = {}) {
  const clauses = [];
  const params = [];
  let i = 1;

  if (filter.pipeline_id) { clauses.push(`pipeline_id = $${i++}`); params.push(filter.pipeline_id); }
  if (filter.owner_id) { clauses.push(`owner_id = $${i++}`); params.push(filter.owner_id); }
  if (filter.status) { clauses.push(`status = $${i++}`); params.push(filter.status); }
  if (filter.search) {
    const term = `%${filter.search.toLowerCase()}%`;
    clauses.push(`(LOWER(source) LIKE $${i} OR EXISTS (SELECT 1 FROM contacts c WHERE c.id = leads.contact_id AND (LOWER(c.email) LIKE $${i} OR c.phone_normalized LIKE $${i} OR LOWER(c.name) LIKE $${i})))`);
    params.push(term);
    i += 0; // same param used thrice
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return { where, params };
}

async function listLeads(filter = {}, { limit = 50, offset = 0 } = {}) {
  const { where, params } = buildFilters(filter);
  const sql = `
    SELECT l.*, c.name AS contact_name, c.email, c.phone, c.phone_normalized, c.email_normalized
      FROM leads l
      JOIN contacts c ON c.id = l.contact_id
      ${where}
     ORDER BY l.created_at DESC
     LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
  `;
  const { rows } = await db.query(sql, [...params, limit, offset]);
  return rows || [];
}

async function createLead({ contact, pipeline_id = null, owner_id = null, source = 'desconhecida', status = 'open', score = 0, notes = null }) {
  const contactRow = await ContactModel.upsert(contact || {});
  if (!contactRow) {
    throw new Error('Contato inválido para o lead');
  }

  const sql = `
    INSERT INTO leads (contact_id, pipeline_id, owner_id, source, status, score, notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (contact_id) DO UPDATE SET
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
    contactRow.id,
    pipeline_id,
    owner_id,
    source,
    status,
    score,
    notes,
  ];

  const { rows } = await db.query(sql, params);
  return rows?.[0] || null;
}

async function findById(id) {
  const sql = 'SELECT * FROM leads WHERE id = $1 LIMIT 1';
  const { rows } = await db.query(sql, [id]);
  return rows?.[0] || null;
}

module.exports = {
  createLead,
  findById,
  listLeads,
};
