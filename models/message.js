// models/message.js
// Comentários em pt-BR; identificadores em inglês. PG-only (node-postgres).

const db = require('../config/database'); // Pool do pg
const { buildViewerOwnershipFilter } = require('./helpers/viewerScope');
const {
  normalizePhone,
  normalizeEmail,
} = require('../utils/normalizeContact');

const BENCH_ALERTS_VERBOSE = ['1', 'true', 'yes', 'on'].includes(String(process.env.BENCH_ALERTS_VERBOSE || '').toLowerCase());

function benchListLog(...args) {
  if (BENCH_ALERTS_VERBOSE) {
    console.info('[bench-alerts][message.list]', ...args);
  }
}

// ---------------------------- Metadados dinâmicos --------------------------
const TABLE_NAME = 'messages';
const RECIPIENT_USER_COLUMN = 'recipient_user_id';
const RECIPIENT_SECTOR_COLUMN = 'recipient_sector_id';
const CREATED_BY_COLUMN = 'created_by';
const UPDATED_BY_COLUMN = 'updated_by';
const VISIBILITY_COLUMN = 'visibility';
const USER_SECTORS_TABLE = 'user_sectors';
const PARENT_MESSAGE_COLUMN = 'parent_message_id';
let recipientSectorFeatureDisabled = false;

const columnSupportCache = new Map();
const columnCheckPromises = new Map();

const tableSupportCache = new Map();
const tableCheckPromises = new Map();

const BENCH_ALERTS_SKIP_SCHEMA = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.BENCH_ALERTS_SKIP_SCHEMA || '').toLowerCase()
);

if (BENCH_ALERTS_SKIP_SCHEMA) {
  benchListLog('skip schema: usando cache fixo');
  [
    RECIPIENT_USER_COLUMN,
    RECIPIENT_SECTOR_COLUMN,
    CREATED_BY_COLUMN,
    UPDATED_BY_COLUMN,
    PARENT_MESSAGE_COLUMN,
  ].forEach((column) => columnSupportCache.set(column, true));
  tableSupportCache.set(USER_SECTORS_TABLE, true);
}

async function supportsColumn(column) {
  if (columnSupportCache.has(column)) {
    return columnSupportCache.get(column);
  }
  if (columnCheckPromises.has(column)) {
    return columnCheckPromises.get(column);
  }

  benchListLog(`supportsColumn: ${column}`);
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

async function supportsTable(table) {
  if (tableSupportCache.has(table)) {
    return tableSupportCache.get(table);
  }
  if (tableCheckPromises.has(table)) {
    return tableCheckPromises.get(table);
  }

  benchListLog(`supportsTable: ${table}`);
  const sql = `
    SELECT 1
      FROM information_schema.tables
     WHERE table_schema = current_schema()
       AND table_name = $1
     LIMIT 1
  `;

  const promise = db
    .query(sql, [table])
    .then(({ rowCount }) => {
      const exists = rowCount > 0;
      tableSupportCache.set(table, exists);
      return exists;
    })
    .catch((err) => {
      console.warn(`[messages] não foi possível inspecionar tabela ${table}:`, err.message || err);
      tableSupportCache.set(table, false);
      return false;
    })
    .finally(() => {
      tableCheckPromises.delete(table);
    });

  tableCheckPromises.set(table, promise);
  return promise;
}

async function supportsUserSectorsTable() {
  return supportsTable(USER_SECTORS_TABLE);
}

function invalidateColumnSupport(column) {
  columnSupportCache.set(column, false);
  columnCheckPromises.delete(column);
}

function invalidateTableSupport(table) {
  tableSupportCache.set(table, false);
  tableCheckPromises.delete(table);
}

function extractMissingColumn(err) {
  if (!err) return null;
  const message = String(err.message || '');
  const match = /column "([^"]+)" does not exist/i.exec(message);
  if (match) return match[1];
  return null;
}

function extractMissingTable(err) {
  if (!err) return null;
  const message = String(err.message || '');
  const match = /relation "([^"]+)" does not exist/i.exec(message);
  if (match) return match[1];
  return null;
}

async function handleSchemaError(err, retrying, retryFn) {
  if (retrying) throw err;

  const missingTable = extractMissingTable(err);
  if (missingTable && missingTable === USER_SECTORS_TABLE) {
    console.warn('[messages] fallback: desabilitando filtros por setor (tabela user_sectors ausente)');
    invalidateTableSupport(USER_SECTORS_TABLE);
    return retryFn();
  }

  const missingColumn = extractMissingColumn(err);
  if (missingColumn && OPTIONAL_COLUMNS.has(missingColumn)) {
    console.warn(`[messages] fallback: coluna opcional ausente (${missingColumn})`);
    invalidateColumnSupport(missingColumn);
    if (missingColumn === RECIPIENT_SECTOR_COLUMN) {
      recipientSectorFeatureDisabled = true;
    }
    return retryFn();
  }

  throw err;
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
  'callback_at',
  'notes',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
];

const OPTIONAL_COLUMNS = new Set([
  RECIPIENT_USER_COLUMN,
  RECIPIENT_SECTOR_COLUMN,
  CREATED_BY_COLUMN,
  UPDATED_BY_COLUMN,
  PARENT_MESSAGE_COLUMN,
]);

function composeSelectFields(includeRecipientUserId, includeRecipientSectorId, includeCreatedBy, includeUpdatedBy, includeParentMessageId) {
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
  if (!includeCreatedBy) {
    const idx = fields.indexOf(CREATED_BY_COLUMN);
    if (idx !== -1) fields.splice(idx, 1);
  }
  if (!includeUpdatedBy) {
    const idx = fields.indexOf(UPDATED_BY_COLUMN);
    if (idx !== -1) fields.splice(idx, 1);
  }
  if (includeParentMessageId) {
    const idx = fields.indexOf(CREATED_BY_COLUMN);
    if (idx !== -1) {
      fields.splice(idx, 0, PARENT_MESSAGE_COLUMN);
    } else {
      fields.push(PARENT_MESSAGE_COLUMN);
    }
  }
  return fields;
}

async function resolveSelectColumns() {
  const [
    includeRecipientUserId,
    includeRecipientSectorId,
    includeCreatedBy,
    includeUpdatedBy,
    includeParentMessageId,
  ] = await Promise.all([
    supportsColumn(RECIPIENT_USER_COLUMN),
    supportsColumn(RECIPIENT_SECTOR_COLUMN),
    supportsColumn(CREATED_BY_COLUMN),
    supportsColumn(UPDATED_BY_COLUMN),
    supportsColumn(PARENT_MESSAGE_COLUMN),
  ]);
  const effectiveRecipientSectorId = !recipientSectorFeatureDisabled && includeRecipientSectorId;
  return {
    includeRecipientUserId,
    includeRecipientSectorId: effectiveRecipientSectorId,
    includeCreatedBy,
    includeUpdatedBy,
    includeParentMessageId,
    selectColumns: composeSelectFields(
      includeRecipientUserId,
      effectiveRecipientSectorId,
      includeCreatedBy,
      includeUpdatedBy,
      includeParentMessageId,
    ).join(',\n      '),
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

function normalizeUserId(value) {
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

function normalizeLabelFilter(value) {
  const raw = trim(value).toLowerCase();
  if (!raw) return null;
  return raw;
}

function parseBaseDate(dateInput) {
  const raw = trim(dateInput);
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const parsed = Date.parse(`${raw}T00:00:00`);
    if (!Number.isNaN(parsed)) return new Date(parsed);
  }
  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) return new Date(parsed);
  return null;
}

function normalizeCallbackAt(input, baseDateInput) {
  const raw = trim(input).toLowerCase();
  if (!raw) return null;

  const baseDate = parseBaseDate(baseDateInput);

  const matchHour = raw.match(/^(\d{1,2})h$/);
  if (matchHour) {
    const hour = Number.parseInt(matchHour[1], 10);
    if (Number.isInteger(hour) && hour >= 0 && hour < 24) {
      const reference = baseDate ? new Date(baseDate) : new Date();
      reference.setHours(hour, 0, 0, 0);
      return reference;
    }
  }

  const matchHourMinute = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (matchHourMinute) {
    const hour = Number.parseInt(matchHourMinute[1], 10);
    const minute = Number.parseInt(matchHourMinute[2], 10);
    if ([hour, minute].every((value) => Number.isInteger(value)) && hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
      const reference = baseDate ? new Date(baseDate) : new Date();
      reference.setHours(hour, minute, 0, 0);
      return reference;
    }
  }

  const normalizedInput = trim(input).replace(' ', 'T');
  const parsed = Date.parse(normalizedInput);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed);
  }

  return null;
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
  const callbackProvided = (
    Object.prototype.hasOwnProperty.call(payload, 'callback_at') ||
    Object.prototype.hasOwnProperty.call(payload, 'callbackAt') ||
    Object.prototype.hasOwnProperty.call(payload, 'callback_time')
  );
  const parentProvided = (
    Object.prototype.hasOwnProperty.call(payload, 'parent_message_id') ||
    Object.prototype.hasOwnProperty.call(payload, 'parentMessageId')
  );

  const recipientUserId = recipientUserProvided
    ? normalizeRecipientUserId(payload.recipient_user_id ?? payload.recipientUserId)
    : null;
  const recipientSectorId = recipientSectorProvided
    ? normalizeRecipientSectorId(payload.recipient_sector_id ?? payload.recipientSectorId)
    : null;
  const parentId = parentProvided ? Number(payload.parent_message_id ?? payload.parentMessageId) : null;
  const parentMessageId = Number.isInteger(parentId) && parentId > 0 ? parentId : null;

  let callbackAtValue;
  if (callbackProvided) {
    const callbackInput = payload.callback_at ?? payload.callbackAt ?? payload.callback_time;
    const parsed = normalizeCallbackAt(callbackInput, payload.call_date ?? payload.callDate);
    callbackAtValue = parsed ? new Date(parsed) : null;
  }

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
    callback_at: callbackProvided ? callbackAtValue ?? null : undefined,
    notes: emptyToNull(payload.notes),
  };

  if (recipientUserProvided) {
    data.recipient_user_id = recipientUserId;
  }
  if (recipientSectorProvided) {
    data.recipient_sector_id = recipientSectorId;
  }
  if (parentProvided) {
    data.parent_message_id = parentMessageId;
  }

  return {
    data,
    statusProvided,
    visibilityProvided,
    recipientUserProvided,
    recipientSectorProvided,
    callbackProvided,
    parentProvided,
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
    callback_at: row.callback_at ?? null,
    callbackAt: row.callback_at ?? null,
    notes: row.notes ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    created_by: row.created_by ?? null,
    createdBy: row.created_by ?? null,
    updated_by: row.updated_by ?? null,
    updatedBy: row.updated_by ?? null,
    parent_message_id: row.parent_message_id ?? null,
    parentMessageId: row.parent_message_id ?? null,
  };
}

// ---------------------------- Filtros SQL ----------------------------------
// date_ref: usa call_date (YYYY-MM-DD) válido; senão, created_at::date
const DATE_REF_SQL = `
  CASE
    WHEN call_date IS NOT NULL AND call_date LIKE '____-__-__'
      THEN call_date::date
    ELSE created_at::date
  END
`;

function buildFilters({ status, startDate, endDate, recipient }, startIndex = 1, { dateMode = 'date_ref' } = {}) {
  let index = startIndex;
  const clauses = [];
  const params = [];

  const dateExpression = dateMode === 'callback'
    ? 'callback_at::date'
    : `(${DATE_REF_SQL.trim()})`;

  if (status) {
    clauses.push(`status IN (${ph(index)}, ${ph(index + 1)})`);
    params.push(status.current, status.legacy);
    index += 2;
  }

  if (startDate) {
    clauses.push(`${dateExpression} >= ${ph(index)}::date`);
    params.push(startDate);
    index += 1;
  }

  if (endDate) {
    clauses.push(`${dateExpression} <= ${ph(index)}::date`);
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

function buildContactMatchConditions({ phone, email }, startIndex = 1) {
  let index = startIndex;
  const clauses = [];
  const params = [];
  const normalizedPhone = normalizePhone(phone);
  const normalizedEmail = normalizeEmail(email);

  if (normalizedPhone) {
    clauses.push(`regexp_replace(COALESCE(sender_phone, ''), '[^0-9]+', '', 'g') = ${ph(index)}`);
    params.push(normalizedPhone);
    index += 1;
  }

  if (normalizedEmail) {
    clauses.push(`LOWER(TRIM(sender_email)) = ${ph(index)}`);
    params.push(normalizedEmail);
    index += 1;
  }

  if (clauses.length === 0) {
    return {
      clause: '',
      params: [],
      nextIndex: startIndex,
      empty: true,
    };
  }

  return {
    clause: clauses.length === 1 ? clauses[0] : `(${clauses.join(' OR ')})`,
    params,
    nextIndex: index,
    empty: false,
  };
}

function appendCondition(baseClause, condition) {
  if (!condition) return baseClause;
  if (!baseClause) {
    return `WHERE ${condition}`;
  }
  return `${baseClause} AND ${condition}`;
}

async function buildFilterClause(
  { status, startDate, endDate, recipient, sectorId, label, dateMode = 'date_ref' },
  {
    viewer,
    includeCreatedBy,
    recipientSectorEnabled,
    supportsSectorMembership,
    startIndex = 1,
  } = {}
) {
  const baseFilters = buildFilters(
    { status, startDate, endDate, recipient },
    startIndex,
    { dateMode }
  );

  let whereClause = baseFilters.clause;
  const params = [...baseFilters.params];
  let nextIndex = baseFilters.nextIndex;

  if (dateMode === 'callback') {
    whereClause = appendCondition(whereClause, 'callback_at IS NOT NULL');
  }

  if (sectorId) {
    if (!recipientSectorEnabled) {
      return { clause: 'WHERE 1=0', params: [], nextIndex: startIndex, emptyResult: true };
    }
    whereClause = appendCondition(whereClause, `recipient_sector_id = ${ph(nextIndex)}`);
    params.push(sectorId);
    nextIndex += 1;
  }

  if (label) {
    const supportsLabels = await supportsTable('message_labels');
    if (!supportsLabels) {
      return { clause: 'WHERE 1=0', params: [], nextIndex: startIndex, emptyResult: true };
    }
    whereClause = appendCondition(
      whereClause,
      `id IN (
        SELECT ml.message_id
          FROM message_labels AS ml
         WHERE ml.label = ${ph(nextIndex)}
      )`
    );
    params.push(label);
    nextIndex += 1;
  }

  const ownershipFilter = buildViewerOwnershipFilter(viewer, ph, nextIndex, {
    supportsCreator: includeCreatedBy,
    supportsSectorMembership,
  });

  if (ownershipFilter.clause) {
    whereClause = appendCondition(whereClause, ownershipFilter.clause);
    params.push(...ownershipFilter.params);
    nextIndex = ownershipFilter.nextIndex;
  }

  return { clause: whereClause, params, nextIndex, emptyResult: false };
}

// ---------------------------- CRUD / Listagem ------------------------------
async function create(payload) {
  const {
    includeRecipientUserId,
    includeRecipientSectorId,
    includeCreatedBy,
    includeUpdatedBy,
    includeParentMessageId,
    selectColumns,
  } = await resolveSelectColumns();

  const normalized = normalizePayload(payload);
  const timestamps = attachTimestamps({}, payload);
  const creatorId = normalizeUserId(payload?.created_by ?? payload?.createdBy);
  const updaterSource = payload?.updated_by ?? payload?.updatedBy;
  const updaterId = normalizeUserId(
    updaterSource !== undefined ? updaterSource : creatorId
  );

  const data = {
    ...normalized.data,
    status: normalized.statusProvided && normalized.data.status ? normalized.data.status : 'pending',
  };

  if (normalized.callbackProvided) {
    data.callback_at = normalized.data.callback_at ?? null;
  } else {
    data.callback_at = data.callback_at ?? null;
  }

  if (data.visibility === undefined) {
    data.visibility = 'private';
  }

  if (includeCreatedBy) {
    data.created_by = creatorId ?? null;
  }
  if (includeUpdatedBy) {
    data.updated_by = updaterId ?? null;
  }

  const hasRecipientUserId = Object.prototype.hasOwnProperty.call(data, 'recipient_user_id');
  const shouldIncludeRecipientUserId = includeRecipientUserId && hasRecipientUserId;

  const hasRecipientSectorId = Object.prototype.hasOwnProperty.call(data, 'recipient_sector_id');
  const shouldIncludeRecipientSectorId = includeRecipientSectorId && hasRecipientSectorId;

  const hasParentMessageId = Object.prototype.hasOwnProperty.call(data, PARENT_MESSAGE_COLUMN);
  const shouldIncludeParentMessageId = includeParentMessageId && hasParentMessageId;

  if (!includeRecipientUserId && hasRecipientUserId) {
    delete data.recipient_user_id;
  }

  if (!includeRecipientSectorId && hasRecipientSectorId) {
    delete data.recipient_sector_id;
  }

  if (!includeParentMessageId && hasParentMessageId) {
    delete data.parent_message_id;
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
    'callback_at',
    'notes',
  ];
  const fields = [...baseFields];

  if (!normalized.callbackProvided) {
    const callbackIndex = fields.indexOf('callback_at');
    if (callbackIndex !== -1) fields.splice(callbackIndex, 1);
  } else {
    normalized.data.callback_at = normalized.data.callback_at ?? null;
  }

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
  if (shouldIncludeParentMessageId) {
    fields.push(PARENT_MESSAGE_COLUMN);
  }

  if (includeCreatedBy) {
    fields.push('created_by');
  }

  if (includeUpdatedBy) {
    fields.push('updated_by');
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

async function findById(id, { viewer } = {}, retrying = false) {
  const { selectColumns, includeCreatedBy, includeRecipientSectorId } = await resolveSelectColumns();
  const recipientSectorEnabled = !recipientSectorFeatureDisabled && includeRecipientSectorId;
  const supportsSectorMembership = recipientSectorEnabled && await supportsUserSectorsTable();
  const ownershipFilter = buildViewerOwnershipFilter(viewer, ph, 2, {
    supportsCreator: includeCreatedBy,
    supportsSectorMembership,
  });
  const sql = `
    SELECT ${selectColumns}
      FROM messages
     WHERE id = ${ph(1)}
     ${ownershipFilter.clause ? `AND ${ownershipFilter.clause}` : ''}
     LIMIT 1
  `;
  const params = ownershipFilter.clause ? [id, ...ownershipFilter.params] : [id];
  try {
    const { rows } = await db.query(sql, params);
    return mapRow(rows?.[0]);
  } catch (err) {
    return handleSchemaError(err, retrying, () => findById(id, { viewer }, true));
  }
}

async function update(id, payload, retrying = false) {
  const {
    includeRecipientUserId,
    includeRecipientSectorId,
    includeUpdatedBy,
    includeParentMessageId,
  } = await resolveSelectColumns();
  const normalized = normalizePayload(payload);
  const hasRecipientUserId = Object.prototype.hasOwnProperty.call(normalized.data, 'recipient_user_id');
  const shouldIncludeRecipientUserId = includeRecipientUserId && hasRecipientUserId;
  const hasRecipientSectorId = Object.prototype.hasOwnProperty.call(normalized.data, 'recipient_sector_id');
  const shouldIncludeRecipientSectorId = includeRecipientSectorId && hasRecipientSectorId;
  const hasParentMessageId = Object.prototype.hasOwnProperty.call(normalized.data, PARENT_MESSAGE_COLUMN);
  const shouldIncludeParentMessageId = includeParentMessageId && hasParentMessageId;

  if (!includeRecipientUserId && hasRecipientUserId) {
    delete normalized.data.recipient_user_id;
  }
  if (!includeRecipientSectorId && hasRecipientSectorId) {
    delete normalized.data.recipient_sector_id;
  }
  if (!includeParentMessageId && hasParentMessageId) {
    delete normalized.data.parent_message_id;
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
    'callback_at',
    'notes',
  ];
  const fields = [...baseFields];

  if (!normalized.callbackProvided) {
    const callbackIndex = fields.indexOf('callback_at');
    if (callbackIndex !== -1) fields.splice(callbackIndex, 1);
  } else {
    normalized.data.callback_at = normalized.data.callback_at ?? null;
  }

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
  if (shouldIncludeParentMessageId) {
    fields.push(PARENT_MESSAGE_COLUMN);
  }
  const values = fields.map((field) => normalized.data[field]);
  const assignments = fields.map((field, idx) => `${field} = ${ph(idx + 1)}`);
  const params = [...values];
  let nextIndex = assignments.length + 1;

  // status opcional
  assignments.push(`status = COALESCE(${ph(nextIndex)}, status)`);
  params.push(normalized.statusProvided ? normalized.data.status : null);
  nextIndex += 1;

  assignments.push(`visibility = COALESCE(${ph(nextIndex)}, visibility)`);
  params.push(normalized.visibilityProvided ? normalizeVisibility(normalized.data.visibility) : null);
  nextIndex += 1;

  const hasUpdatedByField = includeUpdatedBy && (
    (payload && Object.prototype.hasOwnProperty.call(payload, 'updated_by')) ||
    (payload && Object.prototype.hasOwnProperty.call(payload, 'updatedBy'))
  );

  if (hasUpdatedByField) {
    assignments.push(`updated_by = ${ph(nextIndex)}`);
    params.push(normalizeUserId(payload.updated_by ?? payload.updatedBy));
    nextIndex += 1;
  }

  assignments.push('updated_at = CURRENT_TIMESTAMP');

  const sql = `
    UPDATE messages
       SET ${assignments.join(', ')}
     WHERE id = ${ph(nextIndex)}
  `;
  params.push(id);
  try {
    const { rowCount } = await db.query(sql, params);
    return rowCount > 0;
  } catch (err) {
    return handleSchemaError(err, retrying, () => update(id, payload, true));
  }
}

async function updateRecipient(id, options = {}, retrying = false) {
  const {
    recipient,
    recipient_user_id = null,
    recipient_sector_id = null,
  } = options;
  const { includeRecipientUserId, includeRecipientSectorId } = await resolveSelectColumns();
  const assignments = [];
  const params = [];
  let index = 0;

  assignments.push(`recipient = ${ph(++index)}`);
  params.push(emptyToNull(recipient));

  if (includeRecipientUserId) {
    assignments.push(`recipient_user_id = ${ph(++index)}`);
    params.push(recipient_user_id ?? null);
  }

  if (includeRecipientSectorId) {
    assignments.push(`recipient_sector_id = ${ph(++index)}`);
    params.push(recipient_sector_id ?? null);
  }

  assignments.push('updated_at = CURRENT_TIMESTAMP');

  const sql = `
    UPDATE messages
       SET ${assignments.join(', ')}
     WHERE id = ${ph(++index)}
  `;

  params.push(id);

  try {
    const { rowCount } = await db.query(sql, params);
    return rowCount > 0;
  } catch (err) {
    return handleSchemaError(err, retrying, () => updateRecipient(id, options, true));
  }
}

async function updateStatus(id, status, { updatedBy, client } = {}, retrying = false) {
  const normalizedStatus = ensureStatus(status);
  const executor = client || db;
  if (updatedBy !== undefined) {
    const canUpdateUser = await supportsColumn(UPDATED_BY_COLUMN);
    if (canUpdateUser) {
      const sqlWithUser = `
      UPDATE messages
         SET status = ${ph(1)},
             updated_by = ${ph(2)},
             updated_at = CURRENT_TIMESTAMP
       WHERE id = ${ph(3)}
    `;
    try {
      const { rowCount } = await executor.query(sqlWithUser, [
        normalizedStatus,
        normalizeUserId(updatedBy),
        id,
      ]);
      return rowCount > 0;
    } catch (err) {
      return handleSchemaError(err, retrying, () => updateStatus(id, status, { updatedBy, client }, true));
    }
    }
  }

  const sql = `
    UPDATE messages
       SET status = ${ph(1)},
           updated_at = CURRENT_TIMESTAMP
     WHERE id = ${ph(2)}
  `;
  try {
    const { rowCount } = await executor.query(sql, [normalizedStatus, id]);
    return rowCount > 0;
  } catch (err) {
    return handleSchemaError(err, retrying, () => updateStatus(id, status, { updatedBy, client }, true));
  }
}

async function remove(id, retrying = false) {
  try {
    const { rowCount } = await db.query(`DELETE FROM messages WHERE id = ${ph(1)}`, [id]);
    return rowCount > 0;
  } catch (err) {
    return handleSchemaError(err, retrying, () => remove(id, true));
  }
}

async function listRelatedMessages(options = {}, retrying = false) {
  const {
    phone,
    email,
    excludeId,
    viewer,
    limit = 5,
  } = options;

  const contactMatch = buildContactMatchConditions({ phone, email }, 1);
  if (contactMatch.empty) {
    return [];
  }

  const {
    selectColumns,
    includeCreatedBy,
    includeRecipientSectorId,
  } = await resolveSelectColumns();
  const recipientSectorEnabled = !recipientSectorFeatureDisabled && includeRecipientSectorId;
  const supportsSectorMembership = recipientSectorEnabled && await supportsUserSectorsTable();

  let whereClause = `WHERE ${contactMatch.clause}`;
  const params = [...contactMatch.params];
  let nextIndex = contactMatch.nextIndex;

  if (excludeId) {
    whereClause = appendCondition(whereClause, `id <> ${ph(nextIndex)}`);
    params.push(excludeId);
    nextIndex += 1;
  }

  const ownershipFilter = buildViewerOwnershipFilter(viewer, ph, nextIndex, {
    supportsCreator: includeCreatedBy,
    supportsSectorMembership,
  });

  if (ownershipFilter.clause) {
    whereClause = appendCondition(whereClause, ownershipFilter.clause);
    params.push(...ownershipFilter.params);
    nextIndex = ownershipFilter.nextIndex;
  }

  const parsedLimit = Number(limit);
  const sanitizedLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 20) : 5;

  const sql = `
    SELECT ${selectColumns}
      FROM messages
      ${whereClause}
  ORDER BY created_at DESC, id DESC
     LIMIT ${ph(nextIndex)}
  `;
  params.push(sanitizedLimit);

  try {
    const { rows } = await db.query(sql, params);
    return rows.map(mapRow);
  } catch (err) {
    return handleSchemaError(err, retrying, () => listRelatedMessages(options, true));
  }
}

async function listContactHistory(options = {}, retrying = false) {
  const {
    phone,
    email,
    viewer,
    limit = 50,
    offset = 0,
    status,
    recipient,
    label,
    labels,
    sectorId,
  } = options;

  const contactMatch = buildContactMatchConditions({ phone, email }, 1);
  if (contactMatch.empty) {
    return [];
  }

  const {
    selectColumns,
    includeCreatedBy,
    includeRecipientSectorId,
  } = await resolveSelectColumns();
  const recipientSectorEnabled = !recipientSectorFeatureDisabled && includeRecipientSectorId;
  const supportsSectorMembership = recipientSectorEnabled && await supportsUserSectorsTable();

  let whereClause = '';
  const params = [];
  let nextIndex = 1;

  whereClause = appendCondition(whereClause, contactMatch.clause);
  params.push(...contactMatch.params);
  nextIndex = contactMatch.nextIndex;

  const statusFilter = translateStatusForQuery(status);
  if (statusFilter) {
    const clause = `status IN (${ph(nextIndex)}, ${ph(nextIndex + 1)})`;
    whereClause = appendCondition(whereClause, clause);
    params.push(statusFilter.current, statusFilter.legacy);
    nextIndex += 2;
  }

  const trimmedRecipient = trim(recipient);
  if (trimmedRecipient) {
    const clause = `LOWER(COALESCE(TRIM(recipient), '')) LIKE ${ph(nextIndex)}`;
    whereClause = appendCondition(whereClause, clause);
    params.push(`%${trimmedRecipient.toLowerCase()}%`);
    nextIndex += 1;
  }

  const sectorNormalized = normalizeRecipientSectorId(
    sectorId ??
    options.recipient_sector_id ??
    options.recipientSectorId
  );

  if (sectorNormalized && recipientSectorEnabled) {
    const clause = `recipient_sector_id = ${ph(nextIndex)}`;
    whereClause = appendCondition(whereClause, clause);
    params.push(sectorNormalized);
    nextIndex += 1;
  }

  let labelFilter = label;
  if (!labelFilter && Array.isArray(labels) && labels.length) {
    labelFilter = labels[0];
  }
  const normalizedLabel = normalizeLabelFilter(labelFilter);
  if (normalizedLabel) {
    const supportsLabels = await supportsTable('message_labels');
    if (supportsLabels) {
      const clause = `
        id IN (
          SELECT ml.message_id
            FROM message_labels AS ml
           WHERE ml.label = ${ph(nextIndex)}
        )
      `;
      whereClause = appendCondition(whereClause, clause);
      params.push(normalizedLabel);
      nextIndex += 1;
    }
  }

  const ownershipFilter = buildViewerOwnershipFilter(viewer, ph, nextIndex, {
    supportsCreator: includeCreatedBy,
    supportsSectorMembership,
  });

  if (ownershipFilter.clause) {
    whereClause = appendCondition(whereClause, ownershipFilter.clause);
    params.push(...ownershipFilter.params);
    nextIndex = ownershipFilter.nextIndex;
  }

  const parsedLimit = Number(limit);
  const sanitizedLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 50;
  const parsedOffset = Number(offset);
  const sanitizedOffset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

  const sql = `
    SELECT ${selectColumns}
      FROM messages
      ${whereClause}
  ORDER BY created_at DESC, id DESC
     LIMIT ${ph(nextIndex)} OFFSET ${ph(nextIndex + 1)}
  `;

  params.push(sanitizedLimit, sanitizedOffset);

  try {
    const { rows } = await db.query(sql, params);
    return rows.map(mapRow);
  } catch (err) {
    return handleSchemaError(err, retrying, () => listContactHistory(options, true));
  }
}

async function list(options = {}, retrying = false) {
  benchListLog('inicio');
  const {
    limit = 10,
    offset = 0,
    status,
    start_date,
    end_date,
    recipient,
    order_by = 'created_at',
    order = 'desc',
    viewer,
    use_callback_date = false,
  } = options;

  benchListLog('resolveSelectColumns: inicio');
  const { selectColumns, includeCreatedBy, includeRecipientSectorId } = await resolveSelectColumns();
  benchListLog('resolveSelectColumns: ok');
  const recipientSectorEnabled = !recipientSectorFeatureDisabled && includeRecipientSectorId;
  if (recipientSectorEnabled) {
    benchListLog('supportsUserSectorsTable: inicio');
  }
  const supportsSectorMembership = recipientSectorEnabled && await supportsUserSectorsTable();
  if (recipientSectorEnabled) {
    benchListLog('supportsUserSectorsTable: ok');
  }

  const parsedLimit = Number(limit);
  const parsedOffset = Number(offset);
  const sanitizedLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 200) : 10;
  const sanitizedOffset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

  const orderByAllowed = ['created_at', 'updated_at', 'id', 'status', 'date_ref', 'callback_at'];
  const orderKey = orderByAllowed.includes(String(order_by)) ? String(order_by) : 'created_at';
  const sort = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const dateOrderSql = `(${DATE_REF_SQL.trim()})`;
  let primaryOrderClause;
  if (orderKey === 'date_ref') {
    primaryOrderClause = `${dateOrderSql} ${sort}`;
  } else if (orderKey === 'callback_at') {
    primaryOrderClause = `callback_at ${sort} NULLS LAST`;
  } else {
    primaryOrderClause = `${orderKey} ${sort}`;
  }

  const statusFilter = translateStatusForQuery(status);
  const startDate = trim(start_date);
  const endDate = trim(end_date);
  const recipientFilter = trim(recipient);
  const sectorId = normalizeRecipientSectorId(
    options.sector_id ??
    options.recipient_sector_id ??
    options.sectorId
  );
  const labelFilter = normalizeLabelFilter(
    options.label ??
    (Array.isArray(options.labels) ? options.labels[0] : null)
  );

  benchListLog('buildFilterClause: inicio');
  const filterResult = await buildFilterClause(
    {
      status: statusFilter,
      startDate: startDate || null,
      endDate: endDate || null,
      recipient: recipientFilter || null,
      sectorId,
      label: labelFilter,
      dateMode: use_callback_date ? 'callback' : 'date_ref',
    },
    {
      viewer,
      includeCreatedBy,
      recipientSectorEnabled,
      supportsSectorMembership,
      startIndex: 1,
    }
  );
  benchListLog('buildFilterClause: ok');

  if (filterResult.emptyResult) {
    benchListLog('emptyResult');
    return [];
  }

  let whereClause = filterResult.clause;
  const queryParams = [...filterResult.params];
  let nextIndex = filterResult.nextIndex;

  const sql = `
    SELECT ${selectColumns}
      FROM messages
      ${whereClause}
  ORDER BY ${primaryOrderClause}, id DESC
     LIMIT ${ph(nextIndex)} OFFSET ${ph(nextIndex + 1)}
  `;

  try {
    benchListLog('query: inicio');
    const { rows } = await db.query(sql, [...queryParams, sanitizedLimit, sanitizedOffset]);
    benchListLog(`query: ok rows=${rows.length}`);
    return rows.map(mapRow);
  } catch (err) {
    return handleSchemaError(err, retrying, () => list(options, true));
  }
}

async function listWithTotal(options = {}, retrying = false) {
  const {
    limit = 10,
    offset = 0,
    status,
    start_date,
    end_date,
    recipient,
    order_by = 'created_at',
    order = 'desc',
    viewer,
    use_callback_date = false,
  } = options;

  const { selectColumns, includeCreatedBy, includeRecipientSectorId } = await resolveSelectColumns();
  const recipientSectorEnabled = !recipientSectorFeatureDisabled && includeRecipientSectorId;
  const supportsSectorMembership = recipientSectorEnabled && await supportsUserSectorsTable();

  const parsedLimit = Number(limit);
  const parsedOffset = Number(offset);
  const sanitizedLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 200) : 10;
  const sanitizedOffset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

  const orderByAllowed = ['created_at', 'updated_at', 'id', 'status', 'date_ref', 'callback_at'];
  const orderKey = orderByAllowed.includes(String(order_by)) ? String(order_by) : 'created_at';
  const sort = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const dateOrderSql = `(${DATE_REF_SQL.trim()})`;
  let primaryOrderClause;
  if (orderKey === 'date_ref') {
    primaryOrderClause = `${dateOrderSql} ${sort}`;
  } else if (orderKey === 'callback_at') {
    primaryOrderClause = `callback_at ${sort} NULLS LAST`;
  } else {
    primaryOrderClause = `${orderKey} ${sort}`;
  }

  const statusFilter = translateStatusForQuery(status);
  const startDate = trim(start_date);
  const endDate = trim(end_date);
  const recipientFilter = trim(recipient);
  const sectorId = normalizeRecipientSectorId(
    options.sector_id ??
    options.recipient_sector_id ??
    options.sectorId
  );
  const labelFilter = normalizeLabelFilter(
    options.label ??
    (Array.isArray(options.labels) ? options.labels[0] : null)
  );

  const filterResult = await buildFilterClause(
    {
      status: statusFilter,
      startDate: startDate || null,
      endDate: endDate || null,
      recipient: recipientFilter || null,
      sectorId,
      label: labelFilter,
      dateMode: use_callback_date ? 'callback' : 'date_ref',
    },
    {
      viewer,
      includeCreatedBy,
      recipientSectorEnabled,
      supportsSectorMembership,
      startIndex: 1,
    }
  );

  if (filterResult.emptyResult) {
    return { rows: [], total: 0 };
  }

  let whereClause = filterResult.clause;
  const queryParams = [...filterResult.params];
  let nextIndex = filterResult.nextIndex;

  const dataSql = `
    SELECT ${selectColumns}
      FROM messages
      ${whereClause}
  ORDER BY ${primaryOrderClause}, id DESC
     LIMIT ${ph(nextIndex)} OFFSET ${ph(nextIndex + 1)}
  `;

  const countSql = `
    SELECT COUNT(*)::int AS count
      FROM messages
      ${whereClause}
  `;

  try {
    const [dataResult, countResult] = await Promise.all([
      db.query(dataSql, [...queryParams, sanitizedLimit, sanitizedOffset]),
      db.query(countSql, queryParams),
    ]);

    const total = Number(countResult.rows?.[0]?.count || 0);
    return {
      rows: dataResult.rows.map(mapRow),
      total,
    };
  } catch (err) {
    return handleSchemaError(err, retrying, () => listWithTotal(options, true));
  }
}

async function listRecent(limit = 10, { viewer } = {}) {
  return list({ limit, order_by: 'created_at', order: 'desc', viewer });
}

// ---------------------------- Estatísticas ---------------------------------
async function stats({ viewer } = {}) {
  const supportsCreator = await supportsColumn(CREATED_BY_COLUMN);
  const supportsRecipientSector = !recipientSectorFeatureDisabled && await supportsColumn(RECIPIENT_SECTOR_COLUMN);
  const supportsSectorMembership = supportsRecipientSector && await supportsUserSectorsTable();
  const totalFilter = buildViewerOwnershipFilter(viewer, ph, 1, {
    supportsCreator,
    supportsSectorMembership,
  });
  const totalSql = `
    SELECT COUNT(*)::int AS count
      FROM messages
      ${totalFilter.clause ? `WHERE ${totalFilter.clause}` : ''}
  `;
  const total = await db.query(totalSql, totalFilter.params);

  const statusFilter = buildViewerOwnershipFilter(viewer, ph, 1, {
    supportsCreator,
    supportsSectorMembership,
  });
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

  const supportsCreator = await supportsColumn(CREATED_BY_COLUMN);
  const supportsRecipientSector = !recipientSectorFeatureDisabled && await supportsColumn(RECIPIENT_SECTOR_COLUMN);
  const supportsSectorMembership = supportsRecipientSector && await supportsUserSectorsTable();
  const filter = buildViewerOwnershipFilter(viewer, ph, 1, {
    supportsCreator,
    supportsSectorMembership,
  });
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
  const supportsCreator = await supportsColumn(CREATED_BY_COLUMN);
  const supportsRecipientSector = !recipientSectorFeatureDisabled && await supportsColumn(RECIPIENT_SECTOR_COLUMN);
  const supportsSectorMembership = supportsRecipientSector && await supportsUserSectorsTable();
  const filter = buildViewerOwnershipFilter(viewer, ph, 1, {
    supportsCreator,
    supportsSectorMembership,
  });
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
  const supportsCreator = await supportsColumn(CREATED_BY_COLUMN);
  const supportsRecipientSector = !recipientSectorFeatureDisabled && await supportsColumn(RECIPIENT_SECTOR_COLUMN);
  const supportsSectorMembership = supportsRecipientSector && await supportsUserSectorsTable();
  const filter = buildViewerOwnershipFilter(viewer, ph, 1, {
    alias: 'ms',
    supportsCreator,
    supportsSectorMembership,
  });
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

async function widgetCounters(options = {}, retrying = false) {
  const {
    status,
    start_date,
    end_date,
    recipient,
    viewer,
  } = options;

  const { includeCreatedBy, includeRecipientSectorId } = await resolveSelectColumns();
  const recipientSectorEnabled = !recipientSectorFeatureDisabled && includeRecipientSectorId;
  const supportsSectorMembership = recipientSectorEnabled && await supportsUserSectorsTable();

  const statusFilter = translateStatusForQuery(status);
  const startDate = trim(start_date);
  const endDate = trim(end_date);
  const recipientFilter = trim(recipient);
  const sectorId = normalizeRecipientSectorId(
    options.sector_id ??
    options.recipient_sector_id ??
    options.sectorId
  );
  const labelFilter = normalizeLabelFilter(
    options.label ??
    (Array.isArray(options.labels) ? options.labels[0] : null)
  );

  try {
    const filterResult = await buildFilterClause(
      {
        status: statusFilter,
        startDate: startDate || null,
        endDate: endDate || null,
        recipient: recipientFilter || null,
        sectorId,
        label: labelFilter,
      },
      {
        viewer,
        includeCreatedBy,
        recipientSectorEnabled,
        supportsSectorMembership,
        startIndex: 1,
      }
    );

    if (filterResult.emptyResult) {
      return { dueToday: 0, overdue: 0, sla48: 0 };
    }

    const whereClause = filterResult.clause;

    const sql = `
      SELECT
        COUNT(*) FILTER (
          WHERE status <> 'resolved' AND ${DATE_REF_SQL.trim()} = CURRENT_DATE
        )::int AS due_today,
        COUNT(*) FILTER (
          WHERE status <> 'resolved' AND ${DATE_REF_SQL.trim()} < CURRENT_DATE
        )::int AS overdue,
        COUNT(*) FILTER (
          WHERE status = 'pending' AND created_at <= NOW() - INTERVAL '48 hours'
        )::int AS sla48
      FROM messages
      ${whereClause}
    `;

    const { rows } = await db.query(sql, [...filterResult.params]);
    const row = rows?.[0] || {};
    return {
      dueToday: Number(row.due_today || 0),
      overdue: Number(row.overdue || 0),
      sla48: Number(row.sla48 || 0),
    };
  } catch (err) {
    return handleSchemaError(err, retrying, () => widgetCounters(options, true));
  }
}

// ---------------------------- Exports --------------------------------------
module.exports = {
  create,
  findById,
  update,
  updateStatus,
  remove,
  list,
  listWithTotal,
  listRelatedMessages,
  listContactHistory,
  listRecent,
  stats,
  statsByRecipient,
  statsByStatus,
  statsByMonth,
  widgetCounters,
  normalizeStatus,
  STATUS_VALUES,
  STATUS_LABELS_PT,
  updateRecipient,
  STATUS_TRANSLATIONS: {
    enToPt: { ...STATUS_EN_TO_PT },
    ptToEn: { ...STATUS_PT_TO_EN },
    labelsPt: { ...STATUS_LABELS_PT },
  },
};
