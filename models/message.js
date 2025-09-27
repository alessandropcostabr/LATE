const database = require('../config/database');

function db() {
  return database.db();
}

function ph(index) {
  return database.placeholder(index);
}

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

function attachTimestamps(payload, source = {}) {
  return {
    ...payload,
    created_at: emptyToNull(source.created_at),
    updated_at: emptyToNull(source.updated_at),
  };
}

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
    clauses.push(`DATE(COALESCE(NULLIF(TRIM(call_date), ''), CAST(created_at AS TEXT))) >= DATE(${ph(index)})`);
    params.push(startDate);
    index += 1;
  }

  if (endDate) {
    clauses.push(`DATE(COALESCE(NULLIF(TRIM(call_date), ''), CAST(created_at AS TEXT))) <= DATE(${ph(index)})`);
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

async function create(payload) {
  const normalized = normalizePayload(payload);
  const timestamps = attachTimestamps({}, payload);
  const data = {
    ...normalized.data,
    status: normalized.statusProvided && normalized.data.status ? normalized.data.status : 'pending',
  };
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
    'callback_time',
    'notes',
  ];
  const fields = [...baseFields];
  const values = baseFields.map((field) => data[field]);
  if (timestamps.created_at) {
    fields.push('created_at');
    values.push(timestamps.created_at);
  }
  if (timestamps.updated_at) {
    fields.push('updated_at');
    values.push(timestamps.updated_at);
  }
  const stmt = db().prepare(`
    INSERT INTO messages (
      ${fields.join(',\n      ')}
    ) VALUES (
      ${fields.map((_, index) => ph(index + 1)).join(', ')}
    )
    RETURNING ${SELECT_COLUMNS}
  `);
  const row = await stmt.get(values);
  return row?.id || null;
}

async function findById(id) {
  const stmt = db().prepare(`
    SELECT ${SELECT_COLUMNS}
      FROM messages
     WHERE id = ${ph(1)}
     LIMIT 1
  `);
  const row = await stmt.get([id]);
  return mapRow(row);
}

async function update(id, payload) {
  const normalized = normalizePayload(payload);
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
  const values = fields.map((field) => normalized.data[field]);
  const assignments = fields.map((field, idx) => `${field} = ${ph(idx + 1)}`);
  const statusIndex = assignments.length + 1;
  assignments.push(`status = COALESCE(${ph(statusIndex)}, status)`);
  assignments.push('updated_at = CURRENT_TIMESTAMP');
  const stmt = db().prepare(`
    UPDATE messages
       SET ${assignments.join(', ')}
     WHERE id = ${ph(statusIndex + 1)}
  `);
  const params = [...values, normalized.statusProvided ? normalized.data.status : null, id];
  const result = await stmt.run(params);
  return result.changes > 0;
}

async function updateStatus(id, status) {
  const stmt = db().prepare(`
    UPDATE messages
       SET status = ${ph(1)},
           updated_at = CURRENT_TIMESTAMP
     WHERE id = ${ph(2)}
  `);
  const result = await stmt.run([ensureStatus(status), id]);
  return result.changes > 0;
}

async function remove(id) {
  const stmt = db().prepare(`DELETE FROM messages WHERE id = ${ph(1)}`);
  const result = await stmt.run([id]);
  return result.changes > 0;
}

async function list({ limit = 10, offset = 0, status, start_date, end_date, recipient } = {}) {
  const parsedLimit = Number(limit);
  const parsedOffset = Number(offset);
  const sanitizedLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 200) : 10;
  const sanitizedOffset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;
  const statusFilter = translateStatusForQuery(status);
  const startDate = trim(start_date);
  const endDate = trim(end_date);
  const recipientFilter = trim(recipient);

  const filters = buildFilters({
    status: statusFilter,
    startDate: startDate || null,
    endDate: endDate || null,
    recipient: recipientFilter || null,
  });

  const rowsStmt = db().prepare(`
    SELECT ${SELECT_COLUMNS}
      FROM messages
      ${filters.clause}
  ORDER BY id DESC
     LIMIT ${ph(filters.nextIndex)} OFFSET ${ph(filters.nextIndex + 1)}
  `);
  const rows = await rowsStmt.all([...filters.params, sanitizedLimit, sanitizedOffset]);

  const countFilters = buildFilters({
    status: statusFilter,
    startDate: startDate || null,
    endDate: endDate || null,
    recipient: recipientFilter || null,
  });
  const countStmt = db().prepare(`SELECT COUNT(*) AS total FROM messages ${countFilters.clause}`);
  const countRow = await countStmt.get(countFilters.params);
  const total = Number(countRow?.total || 0);

  return rows.map(mapRow);
}

async function listRecent(limit = 10) {
  return list({ limit });
}

async function stats() {
  const totalRow = await db().prepare('SELECT COUNT(*) AS count FROM messages').get();
  const rows = await db().prepare('SELECT status, COUNT(*) AS count FROM messages GROUP BY status').all();
  const counters = rows.reduce((acc, row) => {
    const normalized = ensureStatus(row.status);
    acc[normalized] = (acc[normalized] || 0) + Number(row.count || 0);
    return acc;
  }, {});

  return {
    total: Number(totalRow?.count || 0),
    pending: counters.pending || 0,
    in_progress: counters.in_progress || 0,
    resolved: counters.resolved || 0,
  };
}

async function statsByRecipient({ limit = 10 } = {}) {
  const parsedLimit = Number(limit);
  const sanitizedLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 10;
  const stmt = db().prepare(`
    SELECT
      COALESCE(NULLIF(TRIM(recipient), ''), 'Não informado') AS recipient,
      COUNT(*) AS count
      FROM messages
  GROUP BY recipient
  ORDER BY count DESC, recipient ASC
     LIMIT ${ph(1)}
  `);
  const rows = await stmt.all([sanitizedLimit]);
  return rows.map(row => ({ recipient: row.recipient, count: Number(row.count || 0) }));
}

async function statsByStatus() {
  const rows = await db().prepare(`
    SELECT status, COUNT(*) AS count
      FROM messages
  GROUP BY status
  `).all();
  const totals = STATUS_VALUES.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {});
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

async function statsByMonth({ limit = 12 } = {}) {
  const parsedLimit = Number(limit);
  const sanitizedLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 120) : 12;
  const stmt = db().prepare(`
    SELECT
      SUBSTR(
        COALESCE(
          NULLIF(TRIM(call_date), ''),
          CAST(created_at AS TEXT)
        ),
        1,
        7
      ) AS month,
      COUNT(*) AS count
      FROM messages
  GROUP BY month
    HAVING month IS NOT NULL AND month <> ''
  ORDER BY month DESC
     LIMIT ${ph(1)}
  `);
  const rows = await stmt.all([sanitizedLimit]);
  return rows.reverse().map(row => ({ month: row.month, count: Number(row.count || 0) }));
}

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
