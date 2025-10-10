// models/message.js
// Comentários em pt-BR; identificadores em inglês. PG-only (node-postgres).

const db = require('../config/database'); // Pool do pg
const { buildViewerOwnershipFilter } = require('./helpers/viewerScope');

// ---------------------------- Metadados dinâmicos --------------------------
const TABLE_NAME = 'messages';
const RECIPIENT_USER_COLUMN = 'recipient_user_id';
const RECIPIENT_SECTOR_COLUMN = 'recipient_sector_id';
const VISIBILITY_COLUMN = 'visibility';

const columnSupportCache = new Map();
const columnCheckPromises = new Map();

async function supportsColumn(column) {
  if (columnSupportCache.has(column)) {
    return columnSupportCache.get(column);
  }
  if (columnCheckPromises.has(column)) {
    return columnCheckPromises.get(column);
  }

  const sql = `
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = $1
       AND column_name = $2
     LIMIT 1
  `;

  const promise = db
    .query(sql, [TABLE_NAME, column])
    .then(({ rowCount }) => {
      const exists = rowCount > 0;
      columnSupportCache.set(column, exists);
      return exists;
    })
    .catch((err) => {
      console.warn(`[messages] não foi possível inspecionar coluna ${column}:`, err.message || err);
      columnSupportCache.set(column, false);
      return false;
    })
    .finally(() => {
      columnCheckPromises.delete(column);
    });

  columnCheckPromises.set(column, promise);
  return promise;
}

const BASE_SELECT_FIELDS = [
  'id',
  'call_date',
  'call_time',
  'recipient',
  'sender_name',
  'sender_phone',
  'sender_email',
  'subject',
  'message',
  'status',
  'visibility',
  'callback_time',
  'notes',
  'created_at',
  'updated_at',
];

function composeSelectFields(includeRecipientUserId, includeRecipientSectorId) {
  const fields = [...BASE_SELECT_FIELDS];
  if (includeRecipientUserId) {
    const recipientIndex = fields.indexOf('recipient');
    const insertAt = recipientIndex >= 0 ? recipientIndex + 1 : fields.length;
    fields.splice(insertAt, 0, RECIPIENT_USER_COLUMN);
  }
  if (includeRecipientSectorId) {
    const recipientIndex = fields.indexOf('recipient');
    const insertAt = recipientIndex >= 0 ? recipientIndex + 1 : fields.length;
    fields.splice(insertAt, 0, RECIPIENT_SECTOR_COLUMN);
  }
  return fields;
}

async function resolveSelectColumns() {
  const [includeRecipientUserId, includeRecipientSectorId] = await Promise.all([
    supportsColumn(RECIPIENT_USER_COLUMN),
    supportsColumn(RECIPIENT_SECTOR_COLUMN),
  ]);
  return {
    includeRecipientUserId,
    includeRecipientSectorId,
    selectColumns: composeSelectFields(includeRecipientUserId, includeRecipientSectorId).join(',\n      '),
  };
}

// Helper de placeholder para PG ($1, $2, ...)
function ph(i) {
  return `$${i}`;
}

// ---------------------------- Status e labels -------------------------------
const STATUS_EN_TO_PT = {
  pending: 'pendente',
  in_progress: 'em_andamento',
  resolved: 'resolvido',
};

const STATUS_LABELS_PT = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  resolved: 'Resolvido',
};

const STATUS_PT_TO_EN = Object.entries(STATUS_EN_TO_PT).reduce((acc, [en, pt]) => {
  acc[pt] = en;
  return acc;
}, {});

const STATUS_VALUES = Object.keys(STATUS_EN_TO_PT);

const LEGACY_STATUS_ALIASES = {
  pendente: 'pending',
  aberto: 'pending',
  open: 'pending',
  andamento: 'in_progress',
  'em andamento': 'in_progress',
  'em-andamento': 'in_progress',
  resolvido: 'resolved',
  fechado: 'resolved',
  concluido: 'resolved',
  concluído: 'resolved',
  closed: 'resolved',
};

// ---------------------------- Utils de normalização ------------------------
function toString(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}
function trim(value) {
  return toString(value).trim();
}
function emptyToNull(value) {
  const v = trim(value);
  return v === '' ? null : v;
}

function normalizeRecipientUserId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeRecipientSectorId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeVisibility(raw) {
  const value = String(raw || 'private').trim().toLowerCase();
  return value === 'public' ? 'public' : 'private';
}

function normalizeStatus(raw) {
  const base = trim(raw);
  if (!base) return 'pending';
  const normalized = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (STATUS_EN_TO_PT[normalized]) return normalized;
  if (STATUS_PT_TO_EN[normalized]) return STATUS_PT_TO_EN[normalized];
  if (LEGACY_STATUS_ALIASES[normalized]) return LEGACY_STATUS_ALIASES[normalized];
  return 'pending';
}
function ensureStatus(value) {
  const normalized = normalizeStatus(value);
  return STATUS_VALUES.includes(normalized) ? normalized : 'pending';
}
function translateStatusForQuery(status) {
  if (!status) return null;
  const normalized = normalizeStatus(status);
  return {
    current: normalized,
    legacy: STATUS_EN_TO_PT[normalized] || normalized,
  };
}

// ---------------------------- Normalização de payload ----------------------
function normalizePayload(payload = {}) {
  const messageContent = trim(payload.message || payload.notes || '');
  const statusProvided = Object.prototype.hasOwnProperty.call(payload, 'status');
  const visibilityProvided = Object.prototype.hasOwnProperty.call(payload, 'visibility');
  const recipientUserProvided = Object.prototype.hasOwnProperty.call(payload, 'recipient_user_id') ||
    Object.prototype.hasOwnProperty.call(payload, 'recipientUserId');
  const recipientSectorProvided = Object.prototype.hasOwnProperty.call(payload, 'recipient_sector_id') ||
    Object.prototype.hasOwnProperty.call(payload, 'recipientSectorId');

  const recipientUserId = recipientUserProvided
    ? normalizeRecipientUserId(payload.recipient_user_id ?? payload.recipientUserId)
    : null;
  const recipientSectorId = recipientSectorProvided
    ? normalizeRecipientSectorId(payload.recipient_sector_id ?? payload.recipientSectorId)
    : null;

  const data = {
    call_date: emptyToNull(payload.call_date),
    call_time: emptyToNull(payload.call_time),
    recipient: emptyToNull(payload.recipient),
    sender_name: emptyToNull(payload.sender_name),
    sender_phone: emptyToNull(payload.sender_phone),
    sender_email: emptyToNull(payload.sender_email),
    subject: emptyToNull(payload.subject),
    message: messageContent || '(sem mensagem)',
    status: statusProvided ? ensureStatus(payload.status) : null,
    visibility: visibilityProvided ? normalizeVisibility(payload.visibility) : undefined,
    callback_time: emptyToNull(payload.callback_time),
    notes: emptyToNull(payload.notes),
  };

  if (recipientUserProvided) {
    data.recipient_user_id = recipientUserId;
  }
  if (recipientSectorProvided) {
    data.recipient_sector_id = recipientSectorId;
  }

  return {
    data,
    statusProvided,
    visibilityProvided,
    recipientUserProvided,
    recipientSectorProvided,
  };
}

function attachTimestamps(_payload, source = {}) {
  return {
    created_at: emptyToNull(source.created_at),
    updated_at: emptyToNull(source.updated_at),
  };
}

// ---------------------------- Mapeamento de colunas ------------------------

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    call_date: row.call_date ?? null,
    call_time: row.call_time ?? null,
    recipient: row.recipient ?? null,
    recipient_user_id: row.recipient_user_id ?? null,
    recipientUserId: row.recipient_user_id ?? null,
    recipient_sector_id: row.recipient_sector_id ?? null,
    recipientSectorId: row.recipient_sector_id ?? null,
    sender_name: row.sender_name ?? null,
    sender_phone: row.sender_phone ?? null,
    sender_email: row.sender_email ?? null,
    subject: row.subject ?? null,
    message: row.message ?? null,
    status: ensureStatus(row.status),
    visibility: normalizeVisibility(row.visibility),
    callback_time: row.callback_time ?? null,
    notes: row.notes ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

// ---------------------------- Filtros SQL ----------------------------------
// date_ref: usa call_date (YYYY-MM-DD) válido; senão, created_at::date
const DATE_REF_SQL = `
  CASE
    WHEN call_date IS NOT NULL AND call_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      THEN call_date::date
    ELSE created_at::date
  END
`;

function buildFilters({ status, startDate, endDate, recipient }, startIndex = 1) {
  let index = startIndex;
  const clauses = [];
  const params = [];

  if (status) {
    clauses.push(`status IN (${ph(index)}, ${ph(index + 1)})`);
    params.push(status.current, status.legacy);
    index += 2;
  }

  if (startDate) {
    clauses.push(`${DATE_REF_SQL} >= ${ph(index)}::date`);
    params.push(startDate);
    index += 1;
  }

  if (endDate) {
    clauses.push(`${DATE_REF_SQL} <= ${ph(index)}::date`);
    params.push(endDate);
    index += 1;
  }

  if (recipient) {
    clauses.push(`LOWER(COALESCE(TRIM(recipient), '')) LIKE ${ph(index)}`);
    params.push(`%${recipient.toLowerCase()}%`);
    index += 1;
  }

  return {
    clause: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
    nextIndex: index,
  };
}

// ---------------------------- CRUD / Listagem ------------------------------
async function create(payload) {
  const { includeRecipientUserId, includeRecipientSectorId, selectColumns } = await resolveSelectColumns();

  const normalized = normalizePayload(payload);
  const timestamps = attachTimestamps({}, payload);
  const data = {
    ...normalized.data,
    status: normalized.statusProvided && normalized.data.status ? normalized.data.status : 'pending',
  };

  if (data.visibility === undefined) {
    data.visibility = 'private';
  }

  const hasRecipientUserId = Object.prototype.hasOwnProperty.call(data, 'recipient_user_id');
  const shouldIncludeRecipientUserId = includeRecipientUserId && hasRecipientUserId;

  const hasRecipientSectorId = Object.prototype.hasOwnProperty.call(data, 'recipient_sector_id');
  const shouldIncludeRecipientSectorId = includeRecipientSectorId && hasRecipientSectorId;

  if (!includeRecipientUserId && hasRecipientUserId) {
    delete data.recipient_user_id;
  }

  if (!includeRecipientSectorId && hasRecipientSectorId) {
    delete data.recipient_sector_id;
  }

  const baseFields = [
    'call_date',
    'call_time',
    'recipient',
    'sender_name',
    'sender_phone',
    'sender_email',
    'subject',
    'message',
    'status',
    'visibility',
    'callback_time',
    'notes',
  ];
  const fields = [...baseFields];

  if (shouldIncludeRecipientUserId) {
    const recipientIndex = fields.indexOf('recipient');
    const insertAt = recipientIndex >= 0 ? recipientIndex + 1 : fields.length;
    fields.splice(insertAt, 0, 'recipient_user_id');
  }

  if (shouldIncludeRecipientSectorId) {
    const recipientIndex = fields.indexOf('recipient');
    const insertAt = recipientIndex >= 0 ? recipientIndex + 1 : fields.length;
    fields.splice(insertAt, 0, 'recipient_sector_id');
  }

  const values = fields.map((field) => data[field]);

  if (timestamps.created_at) {
    fields.push('created_at');
    values.push(timestamps.created_at);
  }
  if (timestamps.updated_at) {
    fields.push('updated_at');
    values.push(timestamps.updated_at);
  }

  const sql = `
    INSERT INTO messages (
      ${fields.join(',\n      ')}
    ) VALUES (
      ${fields.map((_, index) => ph(index + 1)).join(', ')}
    )
    RETURNING ${selectColumns}
  `;

  const { rows } = await db.query(sql, values);
  return rows?.[0]?.id || null;
}

async function findById(id, { viewer } = {}) {
  const { selectColumns } = await resolveSelectColumns();
  const ownershipFilter = buildViewerOwnershipFilter(viewer, ph, 2);
  const sql = `
    SELECT ${selectColumns}
      FROM messages
     WHERE id = ${ph(1)}
     ${ownershipFilter.clause ? `AND ${ownershipFilter.clause}` : ''}
     LIMIT 1
  `;
  const params = ownershipFilter.clause ? [id, ...ownershipFilter.params] : [id];
  const { rows } = await db.query(sql, params);
  return mapRow(rows?.[0]);
}

async function update(id, payload) {
  const { includeRecipientUserId, includeRecipientSectorId } = await resolveSelectColumns();
  const normalized = normalizePayload(payload);
  const hasRecipientUserId = Object.prototype.hasOwnProperty.call(normalized.data, 'recipient_user_id');
  const shouldIncludeRecipientUserId = includeRecipientUserId && hasRecipientUserId;
  const hasRecipientSectorId = Object.prototype.hasOwnProperty.call(normalized.data, 'recipient_sector_id');
  const shouldIncludeRecipientSectorId = includeRecipientSectorId && hasRecipientSectorId;

  if (!includeRecipientUserId && hasRecipientUserId) {
    delete normalized.data.recipient_user_id;
  }
  if (!includeRecipientSectorId && hasRecipientSectorId) {
    delete normalized.data.recipient_sector_id;
  }

  const fields = [
    'call_date',
    'call_time',
    'recipient',
    'sender_name',
    'sender_phone',
    'sender_email',
    'subject',
    'message',
    'callback_time',
    'notes',
  ];
  if (shouldIncludeRecipientUserId) {
    const recipientIndex = fields.indexOf('recipient');
    const insertAt = recipientIndex >= 0 ? recipientIndex + 1 : fields.length;
    fields.splice(insertAt, 0, 'recipient_user_id');
  }
  if (shouldIncludeRecipientSectorId) {
    const recipientIndex = fields.indexOf('recipient');
    const insertAt = recipientIndex >= 0 ? recipientIndex + 1 : fields.length;
    fields.splice(insertAt, 0, 'recipient_sector_id');
  }
  const values = fields.map((field) => normalized.data[field]);
  const assignments = fields.map((field, idx) => `${field} = ${ph(idx + 1)}`);

  // status opcional
  const statusIndex = assignments.length + 1;
  assignments.push(`status = COALESCE(${ph(statusIndex)}, status)`);
  const visibilityIndex = assignments.length + 1;
  assignments.push(`visibility = COALESCE(${ph(visibilityIndex)}, visibility)`);
  assignments.push('updated_at = CURRENT_TIMESTAMP');

  const sql = `
    UPDATE messages
       SET ${assignments.join(', ')}
     WHERE id = ${ph(visibilityIndex + 1)}
  `;
  const params = [
    ...values,
    normalized.statusProvided ? normalized.data.status : null,
    normalized.visibilityProvided ? normalizeVisibility(normalized.data.visibility) : null,
    id,
  ];
  const { rowCount } = await db.query(sql, params);
  return rowCount > 0;
}

async function updateStatus(id, status) {
  const sql = `
    UPDATE messages
       SET status = ${ph(1)},
           updated_at = CURRENT_TIMESTAMP
     WHERE id = ${ph(2)}
  `;
  const { rowCount } = await db.query(sql, [ensureStatus(status), id]);
  return rowCount > 0;
}

async function remove(id) {
  const { rowCount } = await db.query(`DELETE FROM messages WHERE id = ${ph(1)}`, [id]);
  return rowCount > 0;
}

async function list({
  limit = 10,
  offset = 0,
  status,
  start_date,
  end_date,
  recipient,
  order_by = 'created_at',
  order = 'desc',
  viewer,
} = {}) {
  const { selectColumns } = await resolveSelectColumns();

  // limites
  const parsedLimit = Number(limit);
  const parsedOffset = Number(offset);
  const sanitizedLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 200) : 10;
  const sanitizedOffset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

  // ordenação segura
  const orderByAllowed = ['created_at', 'updated_at', 'id', 'status'];
  const orderBy = orderByAllowed.includes(String(order_by)) ? String(order_by) : 'created_at';
  const sort = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const statusFilter = translateStatusForQuery(status);
  const startDate = trim(start_date);
  const endDate = trim(end_date);
  const recipientFilter = trim(recipient);

  const filtersResult = buildFilters({
    status: statusFilter,
    startDate: startDate || null,
    endDate: endDate || null,
    recipient: recipientFilter || null,
  });
  let whereClause = filtersResult.clause;
  let params = [...filtersResult.params];
  let nextIndex = filtersResult.nextIndex;

  const ownershipFilter = buildViewerOwnershipFilter(viewer, ph, nextIndex);
  if (ownershipFilter.clause) {
    if (whereClause) {
      whereClause += ` AND ${ownershipFilter.clause}`;
    } else {
      whereClause = `WHERE ${ownershipFilter.clause}`;
    }
    params.push(...ownershipFilter.params);
    nextIndex = ownershipFilter.nextIndex;
  }

  const sql = `
    SELECT ${selectColumns}
      FROM messages
      ${whereClause}
  ORDER BY ${orderBy} ${sort}, id DESC
     LIMIT ${ph(nextIndex)} OFFSET ${ph(nextIndex + 1)}
  `;

  const { rows } = await db.query(sql, [...params, sanitizedLimit, sanitizedOffset]);
  return rows.map(mapRow);
}

async function listRecent(limit = 10, { viewer } = {}) {
  return list({ limit, order_by: 'created_at', order: 'desc', viewer });
}

// ---------------------------- Estatísticas ---------------------------------
async function stats({ viewer } = {}) {
  const totalFilter = buildViewerOwnershipFilter(viewer, ph, 1);
  const totalSql = `
    SELECT COUNT(*)::int AS count
      FROM messages
      ${totalFilter.clause ? `WHERE ${totalFilter.clause}` : ''}
  `;
  const total = await db.query(totalSql, totalFilter.params);

  const statusFilter = buildViewerOwnershipFilter(viewer, ph, 1);
  const statusSql = `
    SELECT status, COUNT(*)::int AS count
      FROM messages
      ${statusFilter.clause ? `WHERE ${statusFilter.clause}` : ''}
  GROUP BY status
  `;
  const byStatus = await db.query(statusSql, statusFilter.params);

  const counters = byStatus.rows.reduce((acc, row) => {
    const normalized = ensureStatus(row.status);
    acc[normalized] = (acc[normalized] || 0) + Number(row.count || 0);
    return acc;
  }, {});

  return {
    total: Number(total.rows?.[0]?.count || 0),
    pending: counters.pending || 0,
    in_progress: counters.in_progress || 0,
    resolved: counters.resolved || 0,
  };
}

async function statsByRecipient({ limit = 10, viewer } = {}) {
  const parsedLimit = Number(limit);
  const sanitizedLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 10;

  const filter = buildViewerOwnershipFilter(viewer, ph, 1);
  const limitIndex = filter.nextIndex;
  const sql = `
    SELECT
      COALESCE(NULLIF(TRIM(recipient), ''), 'Não informado') AS recipient,
      COUNT(*)::int AS count
      FROM messages
      ${filter.clause ? `WHERE ${filter.clause}` : ''}
  GROUP BY recipient
  ORDER BY count DESC, recipient ASC
     LIMIT ${ph(limitIndex)}
  `;

  const { rows } = await db.query(sql, [...filter.params, sanitizedLimit]);
  return rows.map(r => ({ recipient: r.recipient, count: Number(r.count || 0) }));
}

async function statsByStatus({ viewer } = {}) {
  const filter = buildViewerOwnershipFilter(viewer, ph, 1);
  const sql = `
    SELECT status, COUNT(*)::int AS count
      FROM messages
      ${filter.clause ? `WHERE ${filter.clause}` : ''}
  GROUP BY status
  `;
  const { rows } = await db.query(sql, filter.params);
  const totals = STATUS_VALUES.reduce((acc, status) => ({ ...acc, [status]: 0 }), {});
  for (const row of rows) {
    const normalized = ensureStatus(row.status);
    totals[normalized] = (totals[normalized] || 0) + Number(row.count || 0);
  }
  return STATUS_VALUES.map(status => ({
    status,
    label: STATUS_LABELS_PT[status] || status,
    count: totals[status] || 0,
  }));
}

// Série mensal (últimos 12 meses) por created_at — PostgreSQL
async function statsByMonth({ viewer } = {}) {
  const filter = buildViewerOwnershipFilter(viewer, ph, 1, { alias: 'ms' });
  const sql = `
    WITH months AS (
      SELECT date_trunc('month', NOW()) - (INTERVAL '1 month' * generate_series(0, 11)) AS m
    )
    SELECT
      to_char(m, 'YYYY-MM') AS month,
      COALESCE(COUNT(ms.id), 0)::int AS count
    FROM months
    LEFT JOIN messages AS ms
      ON date_trunc('month', ms.created_at) = date_trunc('month', m)
     ${filter.clause ? ` AND ${filter.clause}` : ''}
    GROUP BY m
    ORDER BY m;
  `;
  const { rows } = await db.query(sql, filter.params);
  return rows.map(r => ({ month: r.month, count: Number(r.count || 0) }));
}

// ---------------------------- Exports --------------------------------------
module.exports = {
  create,
  findById,
  update,
  updateStatus,
  remove,
  list,
  listRecent,
  stats,
  statsByRecipient,
  statsByStatus,
  statsByMonth,
  normalizeStatus,
  STATUS_VALUES,
  STATUS_LABELS_PT,
  STATUS_TRANSLATIONS: {
    enToPt: { ...STATUS_EN_TO_PT },
    ptToEn: { ...STATUS_PT_TO_EN },
    labelsPt: { ...STATUS_LABELS_PT },
  },
};
