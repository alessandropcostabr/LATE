// models/activity.js
// Atividades (tarefas/reuniões/chamadas) relacionadas a lead/contato/conta/oportunidade.

const db = require('../config/database');

async function createActivity({
  type = 'task',
  subject,
  starts_at = null,
  ends_at = null,
  owner_id = null,
  related_type = null,
  related_id = null,
  status = 'pending',
  location = null,
}) {
  if (!subject) throw new Error('Assunto é obrigatório');
  const sql = `
    INSERT INTO activities (type, subject, starts_at, ends_at, owner_id, related_type, related_id, status, location)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING *
  `;
  const params = [type, subject, starts_at, ends_at, owner_id, related_type, related_id, status, location];
  const { rows } = await db.query(sql, params);
  return rows?.[0] || null;
}

async function listActivities({ related_type, related_id, owner_id } = {}) {
  const clauses = [];
  const params = [];

  clauses.push('deleted_at IS NULL');
  if (related_type && related_id) {
    params.push(related_type);
    clauses.push(`related_type = $${params.length}`);
    params.push(related_id);
    clauses.push(`related_id = $${params.length}`);
  }
  if (owner_id) {
    params.push(owner_id);
    clauses.push(`owner_id = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const sql = `
    SELECT * FROM activities
    ${where}
    ORDER BY starts_at NULLS LAST, created_at DESC
  `;
  const { rows } = await db.query(sql, params);
  return rows || [];
}

async function updateStatus(id, status) {
  const sql = `
    UPDATE activities
       SET status = $2,
           updated_at = NOW()
     WHERE id = $1
       AND deleted_at IS NULL
     RETURNING *
  `;
  const { rows } = await db.query(sql, [id, status]);
  return rows?.[0] || null;
}

async function findById(id, { includeDeleted = false } = {}) {
  const sql = `
    SELECT * FROM activities
     WHERE id = $1
       ${includeDeleted ? '' : 'AND deleted_at IS NULL'}
     LIMIT 1
  `;
  const { rows } = await db.query(sql, [id]);
  return rows?.[0] || null;
}

module.exports = {
  createActivity,
  listActivities,
  updateStatus,
  findById,
};

async function updateActivity(id, updates = {}) {
  if (!id) return null;
  const fields = [];
  const params = [id];
  let i = 2;

  if (Object.prototype.hasOwnProperty.call(updates, 'type')) {
    fields.push(`type = $${i++}`);
    params.push(updates.type || null);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'subject')) {
    fields.push(`subject = $${i++}`);
    params.push(updates.subject || null);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'starts_at')) {
    fields.push(`starts_at = $${i++}`);
    params.push(updates.starts_at || null);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'ends_at')) {
    fields.push(`ends_at = $${i++}`);
    params.push(updates.ends_at || null);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'status')) {
    fields.push(`status = $${i++}`);
    params.push(updates.status || null);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'location')) {
    fields.push(`location = $${i++}`);
    params.push(updates.location || null);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'related_type')) {
    fields.push(`related_type = $${i++}`);
    params.push(updates.related_type || null);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'related_id')) {
    fields.push(`related_id = $${i++}`);
    params.push(updates.related_id || null);
  }

  if (!fields.length) return null;
  fields.push('updated_at = NOW()');

  const sql = `
    UPDATE activities
       SET ${fields.join(', ')}
     WHERE id = $1
       AND deleted_at IS NULL
     RETURNING *
  `;
  const { rows } = await db.query(sql, params);
  return rows?.[0] || null;
}

async function softDelete(id) {
  if (!id) return null;
  const sql = `
    UPDATE activities
       SET deleted_at = NOW(),
           updated_at = NOW()
     WHERE id = $1
       AND deleted_at IS NULL
     RETURNING *
  `;
  const { rows } = await db.query(sql, [id]);
  return rows?.[0] || null;
}

async function dependencies(_id) {
  return { count: 0 };
}

module.exports.updateActivity = updateActivity;
module.exports.softDelete = softDelete;
module.exports.dependencies = dependencies;
