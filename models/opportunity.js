// models/opportunity.js
// Oportunidades associadas a contato (obrigatório) e conta opcional.

const db = require('../config/database');
const ContactModel = require('./contact');
const PipelineModel = require('./pipeline');

function sanitizeAmount(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function buildFilters(filter = {}) {
  const clauses = [];
  const params = [];
  let i = 1;

  if (filter.pipeline_id) { clauses.push(`o.pipeline_id = $${i++}`); params.push(filter.pipeline_id); }
  if (filter.stage_id) { clauses.push(`o.stage_id = $${i++}`); params.push(filter.stage_id); }
  if (filter.owner_id) { clauses.push(`o.owner_id = $${i++}`); params.push(filter.owner_id); }
  if (filter.contact_id) { clauses.push(`o.contact_id = $${i++}`); params.push(filter.contact_id); }
  if (filter.search) {
    const term = `%${filter.search.toLowerCase()}%`;
    clauses.push(`(LOWER(o.title) LIKE $${i} OR LOWER(c.name) LIKE $${i} OR c.phone_normalized LIKE $${i})`);
    params.push(term);
    i += 0;
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return { where, params };
}

async function listOpportunities(filter = {}, { limit = 50, offset = 0 } = {}) {
  const { where, params } = buildFilters(filter);
  const sql = `
    SELECT o.*, c.name AS contact_name, c.phone, c.email
      FROM opportunities o
      JOIN contacts c ON c.id = o.contact_id
      ${where}
     ORDER BY o.created_at DESC
     LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
  `;
  const { rows } = await db.query(sql, [...params, limit, offset]);
  return rows || [];
}

async function createOpportunity({
  title,
  contact,
  contact_id,
  account_id = null,
  pipeline_id,
  stage_id,
  amount = 0,
  close_date = null,
  owner_id = null,
  source = 'desconhecida',
  description = null,
  probability_override = null,
}) {
  if (!title || (!contact && !contact_id)) {
    throw new Error('Título e contato são obrigatórios');
  }

  let contactId = contact_id;
  if (!contactId) {
    const contactRow = await ContactModel.upsert(contact);
    if (!contactRow) throw new Error('Contato inválido');
    contactId = contactRow.id;
  }

  // valida pipeline / stage coerentes
  const stage = await PipelineModel.getStageById(stage_id);
  if (!stage || stage.pipeline_id !== pipeline_id) {
    throw new Error('Pipeline/estágio inválidos');
  }

  const sql = `
    INSERT INTO opportunities (
      title, account_id, contact_id, pipeline_id, stage_id, amount, close_date,
      owner_id, source, probability_override, description
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING *
  `;

  const params = [
    title,
    account_id || null,
    contactId,
    pipeline_id,
    stage_id,
    sanitizeAmount(amount),
    close_date || null,
    owner_id,
    source,
    probability_override,
    description,
  ];

  const { rows } = await db.query(sql, params);
  return rows?.[0] || null;
}

async function findById(id) {
  const sql = 'SELECT * FROM opportunities WHERE id = $1 LIMIT 1';
  const { rows } = await db.query(sql, [id]);
  return rows?.[0] || null;
}

async function updateStage(opportunityId, targetStageId) {
  const sql = `
    UPDATE opportunities
       SET stage_id = $2,
           updated_at = NOW()
     WHERE id = $1
     RETURNING *
  `;
  const { rows } = await db.query(sql, [opportunityId, targetStageId]);
  return rows?.[0] || null;
}

module.exports = {
  createOpportunity,
  findById,
  updateStage,
  listOpportunities,
};
