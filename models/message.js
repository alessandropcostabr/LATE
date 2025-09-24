const databaseManager = require('../config/database');

function db() {
  return databaseManager.getDatabase();
}

const TABLE = 'messages';

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

function normalizePayload(payload = {}) {
  const messageContent = trim(payload.message || payload.notes || '');
  const statusProvided = Object.prototype.hasOwnProperty.call(payload, 'status');
  return {
    data: {
      call_date: trim(payload.call_date),
      call_time: trim(payload.call_time),
      recipient: trim(payload.recipient),
      sender_name: trim(payload.sender_name),
      sender_phone: emptyToNull(payload.sender_phone),
      sender_email: emptyToNull(payload.sender_email),
      subject: trim(payload.subject),
      message: messageContent || '(sem mensagem)',
      status: statusProvided ? normalizeStatus(payload.status) : null,
      callback_time: emptyToNull(payload.callback_time),
      notes: emptyToNull(payload.notes),
    },
    statusProvided: statusProvided,
  };
}

function mapRow(row) {
  if (!row) return null;
  const status = normalizeStatus(row.status);
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
    status,
    callback_time: row.callback_time ?? null,
    notes: row.notes ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

function migrateLegacyStatuses() {
  const database = db();
  try {
    const statement = database.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=@table LIMIT 1`);
    const exists = statement.get({ table: TABLE });
    if (!exists) return;

    const updates = [
      { from: 'pendente', to: 'pending' },
      { from: 'em_andamento', to: 'in_progress' },
      { from: 'resolvido', to: 'resolved' },
    ];

    const updateStmt = database.prepare(`
      UPDATE ${TABLE}
         SET status = @to
       WHERE status = @from
    `);

    for (const pair of updates) {
      updateStmt.run(pair);
    }
  } catch (err) {
    console.warn('[message:model] Falha ao migrar status legados:', err.message);
  }
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

function attachTimestamps(payload, source = {}) {
  const timestamps = {
    created_at: emptyToNull(source.created_at),
    updated_at: emptyToNull(source.updated_at),
  };
  return { ...payload, ...timestamps };
}

function selectBase(whereClause = '', orderClause = 'ORDER BY id DESC', limitClause = 'LIMIT @limit OFFSET @offset') {
  return `
    SELECT
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
      FROM ${TABLE}
      ${whereClause}
      ${orderClause}
      ${limitClause}
  `;
}

function create(payload) {
  const normalizedPayload = normalizePayload(payload);
  const timestamps = attachTimestamps({}, payload);
  const data = {
    ...normalizedPayload.data,
    status: normalizedPayload.statusProvided && normalizedPayload.data.status
      ? normalizedPayload.data.status
      : 'pending',
  };
  const info = db().prepare(`
    INSERT INTO ${TABLE} (
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
    ) VALUES (
      @call_date,
      @call_time,
      @recipient,
      @sender_name,
      @sender_phone,
      @sender_email,
      @subject,
      @message,
      @status,
      @callback_time,
      @notes,
      COALESCE(@created_at, datetime('now')),
      COALESCE(@updated_at, datetime('now'))
    )
  `).run({ ...data, ...timestamps });

  return info.lastInsertRowid;
}

function findById(id) {
  const row = db().prepare(`
    SELECT
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
      FROM ${TABLE}
     WHERE id = @id
  `).get({ id });
  return mapRow(row);
}

function update(id, payload) {
  const normalizedPayload = normalizePayload(payload);
  const info = db().prepare(`
    UPDATE ${TABLE}
       SET call_date     = @call_date,
           call_time     = @call_time,
           recipient     = @recipient,
           sender_name   = @sender_name,
           sender_phone  = @sender_phone,
           sender_email  = @sender_email,
           subject       = @subject,
           message       = @message,
           status        = COALESCE(@status, status),
           callback_time = @callback_time,
           notes         = @notes,
           updated_at    = datetime('now')
     WHERE id = @id
  `).run({ id, ...normalizedPayload.data, status: normalizedPayload.statusProvided ? normalizedPayload.data.status : null });

  return info.changes > 0;
}

function updateStatus(id, status) {
  const normalized = ensureStatus(status);
  const info = db().prepare(`
    UPDATE ${TABLE}
       SET status = @status,
           updated_at = datetime('now')
     WHERE id = @id
  `).run({ id, status: normalized });
  return info.changes > 0;
}

function remove(id) {
  const info = db().prepare(`DELETE FROM ${TABLE} WHERE id = @id`).run({ id });
  return info.changes > 0;
}

function list({ limit = 10, offset = 0, status } = {}) {
  const parsedLimit = Number(limit);
  const parsedOffset = Number(offset);
  const sanitizedLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 200) : 10;
  const sanitizedOffset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;
  const statusFilter = translateStatusForQuery(status);

  let whereClause = '';
  if (statusFilter) {
    whereClause = 'WHERE status IN (@status, @legacy)';
  }

  const query = selectBase(whereClause);
  const rows = db().prepare(query).all({
    limit: sanitizedLimit,
    offset: sanitizedOffset,
    status: statusFilter ? statusFilter.current : undefined,
    legacy: statusFilter ? statusFilter.legacy : undefined,
  });
  return rows.map(mapRow);
}

function listRecent(limit = 10) {
  return list({ limit });
}

function stats() {
  const database = db();
  const total = database.prepare(`SELECT COUNT(*) AS count FROM ${TABLE}`).get().count;

  const counters = {};
  for (const status of STATUS_VALUES) {
    const legacy = STATUS_EN_TO_PT[status];
    const row = database.prepare(`
      SELECT COUNT(*) AS count
        FROM ${TABLE}
       WHERE status IN (@status, @legacy)
    `).get({ status, legacy });
    counters[status] = row.count;
  }

  return {
    total,
    pending: counters.pending || 0,
    in_progress: counters.in_progress || 0,
    resolved: counters.resolved || 0,
  };
}

migrateLegacyStatuses();

module.exports = {
  create,
  findById,
  update,
  updateStatus,
  remove,
  list,
  listRecent,
  stats,
  normalizeStatus,
  STATUS_VALUES,
  STATUS_LABELS_PT,
  STATUS_TRANSLATIONS: {
    enToPt: { ...STATUS_EN_TO_PT },
    ptToEn: { ...STATUS_PT_TO_EN },
    labelsPt: { ...STATUS_LABELS_PT },
  },
};
