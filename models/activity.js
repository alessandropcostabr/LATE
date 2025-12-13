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
    UPDATE activities SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *
  `;
  const { rows } = await db.query(sql, [id, status]);
  return rows?.[0] || null;
}

module.exports = {
  createActivity,
  listActivities,
  updateStatus,
};
