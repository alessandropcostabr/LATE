// models/eventLog.js
// Acesso aos eventos de auditoria leve (tabela event_logs).

const db = require('../config/database');

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
    where.push(`(el.created_at < $${createdIdx}::timestamptz OR (el.created_at = $${createdIdx}::timestamptz AND el.id < $${idIdx}::uuid))`);
  }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  return { clause, params };
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
    const payload = Buffer.from(`${last.created_at.toISOString()}|${last.id}`).toString('base64');
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

async function getById(id) {
  if (!id) return null;
  const { rows } = await db.query(
    `
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
      WHERE el.id = $1
      LIMIT 1
    `,
    [id],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    event_type: row.event_type,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    actor_user: row.actor_user_id
      ? { id: row.actor_user_id, name: row.actor_user_name || null }
      : null,
    metadata: row.metadata || null,
    created_at: row.created_at,
  };
}

module.exports = {
  listFiltered,
  summary,
  getById,
};
