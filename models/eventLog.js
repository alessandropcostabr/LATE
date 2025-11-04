// models/eventLog.js
// Armazena eventos genéricos de auditoria leve.

const { randomUUID } = require('crypto');
const db = require('../config/database');

function sanitizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function normalizeEntityId(entityId) {
  if (entityId === null || entityId === undefined) return null;
  if (typeof entityId === 'number' || typeof entityId === 'bigint') {
    return String(entityId);
  }
  return String(entityId).trim();
}

async function create({
  eventType,
  entityType,
  entityId,
  actorUserId,
  metadata,
}) {
  const normalizedEvent = sanitizeText(eventType);
  const normalizedEntity = sanitizeText(entityType);
  const normalizedEntityId = normalizeEntityId(entityId);
  const payload = metadata && typeof metadata === 'object' ? metadata : null;

  if (!normalizedEvent || !normalizedEntity || !normalizedEntityId) {
    throw new Error('Parâmetros inválidos para event_log.create');
  }

  const generatedId = randomUUID();

  const { rows } = await db.query(
    `INSERT INTO event_logs (id, event_type, entity_type, entity_id, actor_user_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, event_type, entity_type, entity_id, actor_user_id, metadata, created_at`,
    [
      generatedId,
      normalizedEvent,
      normalizedEntity,
      normalizedEntityId,
      Number.isInteger(actorUserId) ? actorUserId : null,
      payload ? JSON.stringify(payload) : null,
    ],
  );

  return rows?.[0] || null;
}

async function listRecent({ limit = 50, entityType, entityId } = {}) {
  const filters = [];
  const params = [];
  let index = 1;

  if (entityType) {
    filters.push(`entity_type = $${index++}`);
    params.push(sanitizeText(entityType));
  }

  if (entityId !== undefined && entityId !== null) {
    filters.push(`entity_id = $${index++}`);
    params.push(normalizeEntityId(entityId));
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 200));

  const { rows } = await db.query(
    `SELECT id, event_type, entity_type, entity_id, actor_user_id, metadata, created_at
       FROM event_logs
       ${whereClause}
   ORDER BY created_at DESC
      LIMIT ${safeLimit}`,
    params,
  );

  return rows || [];
}

module.exports = {
  create,
  listRecent,
};
