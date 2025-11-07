// services/eventLogFilters.js
// Normaliza filtros reutilizáveis para auditoria (APIs, exports, worker).

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function normalizeEventTypes(value) {
  if (!value) return [];
  const list = Array.isArray(value) ? value : String(value).split(',');
  return list
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .map((item) => item.toLowerCase());
}

function normalizeActorId(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('Responsável inválido.');
  }
  return parsed;
}

function buildEventLogFilters(raw = {}) {
  const toDate = parseDate(raw.to) || new Date();
  const fromDate = parseDate(raw.from) || new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (fromDate > toDate) {
    throw new Error('Período inválido.');
  }

  const eventTypes = normalizeEventTypes(raw.event_type ?? raw.eventTypes);
  const entityType = String(raw.entity_type ?? raw.entityType ?? '').trim();
  const entityId = String(raw.entity_id ?? raw.entityId ?? '').trim();
  const search = String(raw.search ?? '').trim();
  const actorUserId = normalizeActorId(raw.actor_user_id ?? raw.actorUserId);

  return {
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
    eventTypes,
    entityType: entityType || null,
    entityId: entityId || null,
    search: search || null,
    actorUserId,
  };
}

function prepareEventLogFiltersForQuery(filters = {}) {
  const cloned = { ...filters };
  return {
    from: parseDate(cloned.from),
    to: parseDate(cloned.to) || new Date(),
    eventTypes: Array.isArray(cloned.eventTypes) ? cloned.eventTypes : [],
    entityType: cloned.entityType || null,
    entityId: cloned.entityId || null,
    actorUserId: cloned.actorUserId || null,
    search: cloned.search || null,
  };
}

module.exports = {
  buildEventLogFilters,
  prepareEventLogFiltersForQuery,
};
