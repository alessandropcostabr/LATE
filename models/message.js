const databaseManager = require('../config/database');

function db() {
  return databaseManager.getDatabase();
}

const MESSAGE_TABLE_CANDIDATES = ['messages', 'recados'];

function resolveMessageTable() {
  try {
    const database = db();
    const statement = database.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=@table LIMIT 1"
    );

    for (const tableName of MESSAGE_TABLE_CANDIDATES) {
      const found = statement.get({ table: tableName });
      if (found && found.name) return found.name;
    }
  } catch (err) {
    console.warn('[message:model] Falha ao resolver tabela de recados:', err.message);
  }

  return 'recados';
}

const TABLE = resolveMessageTable();

const COLUMN_MAPS = {
  modern: {
    id: 'id',
    call_date: 'call_date',
    call_time: 'call_time',
    recipient: 'recipient',
    sender_name: 'sender_name',
    sender_phone: 'sender_phone',
    sender_email: 'sender_email',
    subject: 'subject',
    message: 'message',
    status: 'status',
    callback_time: 'callback_time',
    notes: 'notes',
    created_at: 'created_at',
    updated_at: 'updated_at',
  },
  legacy: {
    id: 'id',
    call_date: 'data_ligacao',
    call_time: 'hora_ligacao',
    recipient: 'destinatario',
    sender_name: 'remetente_nome',
    sender_phone: 'remetente_telefone',
    sender_email: 'remetente_email',
    subject: 'assunto',
    message: 'mensagem',
    status: 'situacao',
    callback_time: 'horario_retorno',
    notes: 'observacoes',
    created_at: 'criado_em',
    updated_at: 'atualizado_em',
  },
};

function resolveColumnMap(tableName) {
  try {
    const database = db();
    const pragmaStatement = database.prepare(`PRAGMA table_info(${JSON.stringify(tableName)})`);
    const columnsInfo = pragmaStatement.all();
    const columnNames = new Set(columnsInfo.map(column => column.name));

    const isLegacy = ['situacao', 'data_ligacao', 'mensagem'].some(name => columnNames.has(name));
    if (isLegacy) {
      return { schema: 'legacy', map: COLUMN_MAPS.legacy };
    }

    const looksModern = ['call_date', 'message', 'notes'].every(name => columnNames.has(name));
    if (looksModern) {
      return { schema: 'modern', map: COLUMN_MAPS.modern };
    }

    if (tableName === 'recados') {
      return { schema: 'legacy', map: COLUMN_MAPS.legacy };
    }
  } catch (err) {
    console.warn(
      `[message:model] Falha ao inspecionar colunas da tabela ${tableName}:`,
      err.message
    );
  }

  return { schema: 'modern', map: COLUMN_MAPS.modern };
}

let COLUMN_CONFIG = resolveColumnMap(TABLE);
let COLUMN_MAP = COLUMN_CONFIG.map;

function column(name) {
  return COLUMN_MAP[name] || name;
}

const SELECTABLE_FIELDS = [
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
  'callback_time',
  'notes',
  'created_at',
  'updated_at',
];

const INSERT_FIELDS = [
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
  'created_at',
  'updated_at',
];

function buildSelectColumns() {
  return SELECTABLE_FIELDS.map(field => {
    const mapped = column(field);
    return mapped === field ? mapped : `${mapped} AS ${field}`;
  }).join(',\n      ');
}

function buildInsertColumns() {
  return INSERT_FIELDS.map(field => column(field)).join(',\n      ');
}

function buildInsertValues() {
  return INSERT_FIELDS.map(field => {
    if (field === 'created_at' || field === 'updated_at') {
      return `COALESCE(@${field}, datetime('now'))`;
    }
    return `@${field}`;
  }).join(',\n      ');
}

let SELECT_COLUMNS = buildSelectColumns();
let INSERT_COLUMNS = buildInsertColumns();
let INSERT_VALUES = buildInsertValues();
let STATUS_COLUMN = column('status');
let ID_COLUMN = column('id');
let RECIPIENT_COLUMN = column('recipient');
let CALL_DATE_COLUMN = column('call_date');
let CREATED_AT_COLUMN = column('created_at');

function refreshDerivedColumns() {
  COLUMN_MAP = COLUMN_CONFIG.map;
  SELECT_COLUMNS = buildSelectColumns();
  INSERT_COLUMNS = buildInsertColumns();
  INSERT_VALUES = buildInsertValues();
  STATUS_COLUMN = column('status');
  ID_COLUMN = column('id');
  RECIPIENT_COLUMN = column('recipient');
  CALL_DATE_COLUMN = column('call_date');
  CREATED_AT_COLUMN = column('created_at');
}

function refreshColumnConfig() {
  COLUMN_CONFIG = resolveColumnMap(TABLE);
  refreshDerivedColumns();
}

const DETECTION_FIELDS = ['call_date', 'status', 'created_at'];

function inspectTableColumns(tableName) {
  try {
    const pragmaStatement = db().prepare(`PRAGMA table_info(${JSON.stringify(tableName)})`);
    return pragmaStatement.all();
  } catch (err) {
    console.warn(
      `[message:model] Falha ao inspecionar colunas da tabela ${tableName}:`,
      err.message
    );
    return [];
  }
}

function mappingMatchesColumns(currentMap, columnNames) {
  return DETECTION_FIELDS.every(field => {
    const mapped = currentMap[field] || field;
    return columnNames.has(mapped);
  });
}

function ensureColumnConfigUpToDate() {
  const columnsInfo = inspectTableColumns(TABLE);
  if (!columnsInfo.length) {
    return;
  }

  const columnNames = new Set(columnsInfo.map(column => column.name));
  if (!mappingMatchesColumns(COLUMN_MAP, columnNames)) {
    refreshColumnConfig();
  }
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
         SET ${STATUS_COLUMN} = @to
       WHERE ${STATUS_COLUMN} = @from
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

function selectBase(
  whereClause = '',
  orderClause = `ORDER BY ${ID_COLUMN} DESC`,
  limitClause = 'LIMIT @limit OFFSET @offset'
) {
  return `
    SELECT
      ${SELECT_COLUMNS}
      FROM ${TABLE}
      ${whereClause}
      ${orderClause}
      ${limitClause}
  `;
}

function create(payload) {
  ensureColumnConfigUpToDate();
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
      ${INSERT_COLUMNS}
    ) VALUES (
      ${INSERT_VALUES}
    )
  `).run({ ...data, ...timestamps });

  return info.lastInsertRowid;
}

function findById(id) {
  ensureColumnConfigUpToDate();
  const row = db().prepare(`
    SELECT
      ${SELECT_COLUMNS}
      FROM ${TABLE}
     WHERE ${ID_COLUMN} = @id
     LIMIT 1
  `).get({ id });
  return mapRow(row);
}

function update(id, payload) {
  ensureColumnConfigUpToDate();
  const normalizedPayload = normalizePayload(payload);
  const info = db().prepare(`
    UPDATE ${TABLE}
       SET ${column('call_date')}     = @call_date,
           ${column('call_time')}     = @call_time,
           ${column('recipient')}     = @recipient,
           ${column('sender_name')}   = @sender_name,
           ${column('sender_phone')}  = @sender_phone,
           ${column('sender_email')}  = @sender_email,
           ${column('subject')}       = @subject,
           ${column('message')}       = @message,
           ${STATUS_COLUMN}           = COALESCE(@status, ${STATUS_COLUMN}),
           ${column('callback_time')} = @callback_time,
           ${column('notes')}         = @notes,
           ${column('updated_at')}    = datetime('now')
     WHERE ${ID_COLUMN} = @id
  `).run({ id, ...normalizedPayload.data, status: normalizedPayload.statusProvided ? normalizedPayload.data.status : null });

  return info.changes > 0;
}

function updateStatus(id, status) {
  ensureColumnConfigUpToDate();
  const normalized = ensureStatus(status);
  const info = db().prepare(`
    UPDATE ${TABLE}
       SET ${STATUS_COLUMN}        = @status,
           ${column('updated_at')} = datetime('now')
     WHERE ${ID_COLUMN} = @id
  `).run({ id, status: normalized });
  return info.changes > 0;
}

function remove(id) {
  ensureColumnConfigUpToDate();
  const info = db().prepare(`DELETE FROM ${TABLE} WHERE ${ID_COLUMN} = @id`).run({ id });
  return info.changes > 0;
}

function list({ limit = 10, offset = 0, status, start_date, end_date, recipient } = {}) {
  ensureColumnConfigUpToDate();
  const parsedLimit = Number(limit);
  const parsedOffset = Number(offset);
  const sanitizedLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 200) : 10;
  const sanitizedOffset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;
  const statusFilter = translateStatusForQuery(status);

  const startDate = trim(start_date);
  const endDate = trim(end_date);
  const recipientFilter = trim(recipient);
  const effectiveDateColumn = `COALESCE(NULLIF(TRIM(${CALL_DATE_COLUMN}), ''), ${CREATED_AT_COLUMN})`;

  const conditions = [];
  const params = {
    limit: sanitizedLimit,
    offset: sanitizedOffset,
  };

  if (statusFilter) {
    conditions.push(`${STATUS_COLUMN} IN (@status, @legacy)`);
    params.status = statusFilter.current;
    params.legacy = statusFilter.legacy;
  }

  if (startDate) {
    conditions.push(`DATE(${effectiveDateColumn}) >= DATE(@start_date)`);
    params.start_date = startDate;
  }

  if (endDate) {
    conditions.push(`DATE(${effectiveDateColumn}) <= DATE(@end_date)`);
    params.end_date = endDate;
  }

  if (recipientFilter) {
    conditions.push(`LOWER(COALESCE(TRIM(${RECIPIENT_COLUMN}), '')) LIKE @recipient`);
    params.recipient = `%${recipientFilter.toLowerCase()}%`;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = selectBase(whereClause);
  const rows = db().prepare(query).all(params);
  return rows.map(mapRow);
}

function listRecent(limit = 10) {
  return list({ limit });
}

function stats() {
  ensureColumnConfigUpToDate();
  const database = db();
  const total = database.prepare(`SELECT COUNT(*) AS count FROM ${TABLE}`).get().count;

  const counters = {};
  for (const status of STATUS_VALUES) {
    const legacy = STATUS_EN_TO_PT[status];
    const row = database.prepare(`
      SELECT COUNT(*) AS count
        FROM ${TABLE}
       WHERE ${STATUS_COLUMN} IN (@status, @legacy)
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

function sanitizeLimit(limit, { fallback = 10, max = 100 } = {}) {
  const parsed = Number(limit);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.min(Math.floor(parsed), max);
  }
  return fallback;
}

function statsByRecipient({ limit = 10 } = {}) {
  ensureColumnConfigUpToDate();
  const sanitizedLimit = sanitizeLimit(limit, { fallback: 10, max: 100 });
  const rows = db().prepare(`
    SELECT
      COALESCE(NULLIF(TRIM(${RECIPIENT_COLUMN}), ''), 'Não informado') AS recipient,
      COUNT(*) AS count
      FROM ${TABLE}
  GROUP BY recipient
  ORDER BY count DESC, recipient ASC
     LIMIT @limit
  `).all({ limit: sanitizedLimit });

  return rows.map(row => ({ recipient: row.recipient, count: row.count }));
}

function statsByStatus() {
  ensureColumnConfigUpToDate();
  const totals = STATUS_VALUES.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {});

  const rows = db().prepare(`
    SELECT
      ${STATUS_COLUMN} AS raw_status,
      COUNT(*)         AS count
      FROM ${TABLE}
  GROUP BY ${STATUS_COLUMN}
  `).all();

  for (const row of rows) {
    const normalized = normalizeStatus(row.raw_status);
    totals[normalized] = (totals[normalized] || 0) + (row.count || 0);
  }

  return STATUS_VALUES.map(status => ({
    status,
    label: STATUS_LABELS_PT[status] || status,
    count: totals[status] || 0,
  }));
}

function statsByMonth({ limit = 12 } = {}) {
  ensureColumnConfigUpToDate();
  const sanitizedLimit = sanitizeLimit(limit, { fallback: 12, max: 120 });
  const rows = db().prepare(`
    WITH aggregated AS (
      SELECT
        strftime('%Y-%m', CASE
          WHEN ${CALL_DATE_COLUMN} IS NOT NULL AND TRIM(${CALL_DATE_COLUMN}) != ''
            THEN ${CALL_DATE_COLUMN}
          ELSE ${CREATED_AT_COLUMN}
        END) AS month,
        COUNT(*) AS count
        FROM ${TABLE}
    GROUP BY month
      HAVING month IS NOT NULL
    )
    SELECT month, count
      FROM aggregated
  ORDER BY month DESC
     LIMIT @limit
  `).all({ limit: sanitizedLimit });

  return rows.reverse().map(row => ({ month: row.month, count: row.count }));
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
