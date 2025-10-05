// models/message.js
// Comentários em pt-BR; identificadores em inglês.

const database = require('../config/database');

function db() {
  return database.db();
}

function ph(index) {
  return database.placeholder(index);
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
  return {
    data: {
      call_date: emptyToNull(payload.call_date),
      call_time: emptyToNull(payload.call_time),
      recipient: emptyToNull(payload.recipient),
      sender_name: emptyToNull(payload.sender_name),
      sender_phone: emptyToNull(payload.sender_phone),
      sender_email: emptyToNull(payload.sender_email),
      subject: emptyToNull(payload.subject),
      message: messageContent || '(sem mensagem)',
      status: statusProvided ? ensureStatus(payload.status) : null,
      callback_time: emptyToNull(payload.callback_time),
      notes: emptyToNull(payload.notes),
    },
    statusProvided,
  };
}

function attachTimestamps(_payload, source = {}) {
  return {
    created_at: emptyToNull(source.created_at),
    updated_at: emptyToNull(source.updated_at),
  };
}

// ---------------------------- Mapeamento de colunas ------------------------
const SELECT_COLUMNS = `
  id,
  call_date,
  call_time,
  recipient,
  sender_name,
  sender_phone,
  sender_email,
  subject,
  message,
  status,
  callback_time,
  notes,
  created_at,
  updated_at
`;

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    call_date: row.call_date ?? null,
    call_time: row.call_time ?? null,
    recipient: row.recipient ?? null,
    sender_name: row.sender_name ?? null,
    sender_phone: row.sender_phone ?? null,
    sender_email: row.sender_email ?? null,
    subject: row.subject ?? null,
    message: row.message ?? null,
    status: ensureStatus(row.status),
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
    // inclusivo no dia final
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
  const normalized = normalizePayload(payload);
  const timestamps = attachTimestamps({}, payload);
  const data = {
    ...normalized.data,
    status

