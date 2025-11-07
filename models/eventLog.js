// models/eventLog.js
// Auditoria leve (event_logs) com criação, filtros avançados e export helpers.

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

function sanitizeWildcard(value) {
  if (!value) return null;
  const cleaned = String(value).trim();
  if (!cleaned) return null;
  if (cleaned.includes('*')) {
    return cleaned.replace(/\*/g, '%').toLowerCase();
  }
  return cleaned.toLowerCase();
}

function escapeLike(value) {
  if (value === null || value === undefined) return null;
  return String(value).replace(/[%_\\]/g, '\\$&');
}

function buildFilters({
  from,
  to,
  eventTypes = [],
  entityType,
  entityId,
  actorUserId,
  search,
  cursor,
}) {
  const where = [];
  const params = [];

  if (from) {
    params.push(from);
    where.push(`el.created_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    where.push(`el.created_at <= $${params.length}`);
  }

  const normalizedTypes = (Array.isArray(eventTypes) ? eventTypes : [eventTypes])
    .map(sanitizeWildcard)
    .filter(Boolean);

  if (normalizedTypes.length) {
    const parts = normalizedTypes.map((pattern) => {
      params.push(pattern.includes('%') ? pattern : pattern.toLowerCase());
      const placeholder = `$${params.length}`;
      if (pattern.includes('%')) {
        return `LOWER(el.event_type) LIKE ${placeholder}`;
      }
      return `LOWER(el.event_type) = ${placeholder}`;
    });
    where.push(`(${parts.join(' OR ')})`);
  }

  if (entityType) {
    params.push(String(entityType).trim().toLowerCase());
    where.push(`LOWER(el.entity_type) = $${params.length}`);
  }

  if (entityId) {
    params.push(String(entityId).trim());
    where.push(`el.entity_id = $${params.length}`);
  }

  if (actorUserId) {
    params.push(Number(actorUserId));
    where.push(`el.actor_user_id = $${params.length}`);
  }

  if (search) {
    const escaped = escapeLike(search);
    params.push(`%${escaped}%`);
    where.push(`CAST(el.metadata AS TEXT) ILIKE $${params.length}`);
  }

  if (cursor && cursor.createdAt && cursor.id) {
    params.push(cursor.createdAt);
    const createdIdx = params.length;
    params.push(cursor.id);
    const idIdx = params.length;
    where.push(
      `(el.created_at < $${createdIdx}::timestamptz OR (el.created_at = $${createdIdx}::timestamptz AND el.id < $${idIdx}::uuid))`,
    );
  }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  return { clause, params };
}

async function create({
  eventType,
  entityType,
  entityId,
  actorUserId = null,
  metadata = null,
}) {
  const normalizedEvent = sanitizeText(eventType);
  const normalizedEntityType = sanitizeText(entityType);
  const normalizedEntityId = normalizeEntityId(entityId);

  if (!normalizedEvent || !normalizedEntityType || !normalizedEntityId) {
    throw new Error('Evento de auditoria inválido.');
  }

  const payload = metadata && typeof metadata === 'object' ? metadata : null;
  const actor = Number.isInteger(actorUserId) ? actorUserId : null;

  const id = randomUUID();
  const createdAt = new Date();

  const { rows } = await db.query(
    `INSERT INTO event_logs (id, event_type, entity_type, entity_id, actor_user_id, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, event_type, entity_type, entity_id, actor_user_id, metadata, created_at`,
    [id, normalizedEvent, normalizedEntityType, normalizedEntityId, actor, payload, createdAt],
  );

  const row = rows?.[0];
  if (!row) return null;

  return {
    id: row.id,
    event_type: row.event_type,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    actor_user: row.actor_user_id ? { id: row.actor_user_id, name: null } : null,
    metadata: row.metadata || null,
    created_at: row.created_at,
  };
}

async function listFiltered({
  from,
  to,
  eventTypes,
  entityType,
  entityId,
  actorUserId,
  search,
  cursor,
  limit = 50,
}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 500));
  const cursorData = cursor && cursor.createdAt && cursor.id ? cursor : null;

  const { clause, params } = buildFilters({
    from,
    to,
    eventTypes,
    entityType,
    entityId,
    actorUserId,
    search,
    cursor: cursorData,
  });

  const limitValue = safeLimit + 1;

  const sql = `
    SELECT
      el.id,
      el.event_type,
      el.entity_type,
      el.entity_id,
      el.actor_user_id,
      el.metadata,
      el.created_at,
      u.name AS actor_user_name
    FROM event_logs el
    LEFT JOIN users u ON u.id = el.actor_user_id
    ${clause}
    ORDER BY el.created_at DESC, el.id DESC
    LIMIT ${limitValue}
  `;

  const { rows } = await db.query(sql, params);
  const hasMore = rows.length > safeLimit;
  const items = hasMore ? rows.slice(0, -1) : rows;

  let nextCursor = null;
  if (hasMore && items.length) {
    const last = items[items.length - 1];
    const lastDate = last.created_at instanceof Date ? last.created_at : new Date(last.created_at);
    const payload = Buffer.from(`${lastDate.toISOString()}|${last.id}`).toString('base64');
    nextCursor = payload;
  }

  const normalized = items.map((row) => ({
    id: row.id,
    event_type: row.event_type,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    actor_user: row.actor_user_id
      ? { id: row.actor_user_id, name: row.actor_user_name || null }
      : null,
    metadata: row.metadata || null,
    created_at: row.created_at,
  }));

  return { items: normalized, nextCursor };
}

async function summary({ from, to, eventTypes }) {
  const { clause, params } = buildFilters({
    from,
    to,
    eventTypes,
  });

  const byTypeSql = `
    SELECT el.event_type, COUNT(*) AS count
    FROM event_logs el
    ${clause}
    GROUP BY el.event_type
    ORDER BY count DESC
  `;

  const dailySql = `
    SELECT DATE_TRUNC('day', el.created_at) AS day, COUNT(*) AS count
    FROM event_logs el
    ${clause}
    GROUP BY day
    ORDER BY day DESC
  `;

  const [byTypeResult, dailyResult] = await Promise.all([
    db.query(byTypeSql, params),
    db.query(dailySql, params),
  ]);

  return {
    byType: byTypeResult.rows.map((row) => ({
      event_type: row.event_type,
      count: Number(row.count),
    })),
    daily: dailyResult.rows.map((row) => ({
      date: row.day,
      count: Number(row.count),
    })),
  };
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
  listFiltered,
  summary,
  listRecent,
};
