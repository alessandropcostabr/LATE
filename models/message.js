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
      if (found && found.name) {
        return { name: found.name, confirmed: true };
      }
    }
  } catch (err) {
    console.warn('[message:model] Falha ao resolver tabela de recados:', err.message);
  }

  return { name: 'recados', confirmed: false };
}

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
  const fallbackSchema = tableName === 'recados' ? 'legacy' : 'modern';

  try {
    const database = db();
    const pragmaStatement = database.prepare(`PRAGMA table_info(${JSON.stringify(tableName)})`);
    const columnsInfo = pragmaStatement.all();

    if (!columnsInfo || columnsInfo.length === 0) {
      return { schema: fallbackSchema, map: COLUMN_MAPS[fallbackSchema], confirmed: false };
    }

    const columnNames = new Set(columnsInfo.map(column => column.name));

    const isLegacy = ['situacao', 'data_ligacao', 'mensagem'].some(name => columnNames.has(name));
    if (isLegacy) {
      return { schema: 'legacy', map: COLUMN_MAPS.legacy, confirmed: true };
    }

    const looksModern = ['call_date', 'message', 'notes'].every(name => columnNames.has(name));
    if (looksModern) {
      return { schema: 'modern', map: COLUMN_MAPS.modern, confirmed: true };
    }

    return { schema: fallbackSchema, map: COLUMN_MAPS[fallbackSchema], confirmed: false };
  } catch (err) {
    console.warn(
      `[message:model] Falha ao inspecionar colunas da tabela ${tableName}:`,
      err.message
    );
  }

  return { schema: fallbackSchema, map: COLUMN_MAPS[fallbackSchema], confirmed: false };
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

function defaultTableState() {
  return { name: 'recados', confirmed: false };
}

function defaultColumnState() {
  return { schema: 'modern', map: COLUMN_MAPS.modern, confirmed: false };
}

let tableState = defaultTableState();
let columnState = defaultColumnState();
let sqlCache = null;
let legacyMigrationPending = true;

function resetRuntime() {
  tableState = defaultTableState();
  columnState = defaultColumnState();
  sqlCache = null;
  legacyMigrationPending = true;
}

function ensureTable() {
  if (!tableState.confirmed) {
    const resolved = resolveMessageTable();
    const tableChanged = tableState.name !== resolved.name;
    tableState = resolved;
    if (tableChanged) {
      columnState = defaultColumnState();
      sqlCache = null;
    }
  }
  return tableState;
}

function ensureColumnConfig() {
  const { name: tableName } = ensureTable();
  if (!columnState.confirmed) {
    const resolved = resolveColumnMap(tableName);
    const mapChanged = columnState.map !== resolved.map;
    columnState = resolved;
    if (mapChanged) {
      sqlCache = null;
    }
  }
  return columnState;
}

function buildSqlCache(map) {
  const column = name => map[name] || name;
  return {
    map,
    selectColumns: SELECTABLE_FIELDS.map(field => {
      const mapped = column(field);
      return mapped === field ? mapped : `${mapped} AS ${field}`;
    }).join(',\n      '),
    insertColumns: INSERT_FIELDS.map(column).join(',\n      '),
    insertValues: INSERT_FIELDS.map(field => {
      if (field === 'created_at' || field === 'updated_at') {
        return `COALESCE(@${field}, datetime('now'))`;
      }
      return `@${field}`;
    }).join(',\n      '),
    statusColumn: column('status'),
    idColumn: column('id'),
    recipientColumn: column('recipient'),
    callDateColumn: column('call_date'),
    createdAtColumn: column('created_at'),
  };
}

function getRuntime() {
  const tableInfo = ensureTable();
  const columnInfo = ensureColumnConfig();

  if (!sqlCache || sqlCache.map !== columnInfo.map) {
    sqlCache = buildSqlCache(columnInfo.map);
  }

  const column = name => columnInfo.map[name] || name;

  return {
    table: tableInfo.name,
    schema: columnInfo.schema,
    confirmed: tableInfo.confirmed && columnInfo.confirmed,
    column,
    selectColumns: sqlCache.selectColumns,
    insertColumns: sqlCache.insertColumns,
    insertValues: sqlCache.insertValues,
    statusColumn: sqlCache.statusColumn,
    idColumn: sqlCache.idColumn,
    recipientColumn: sqlCache.recipientColumn,
    callDateColumn: sqlCache.callDateColumn,
    createdAtColumn: sqlCache.createdAtColumn,
  };
}

function shouldRetryError(err) {
  if (!err || typeof err.message !== 'string') return false;
  return /no such table/i.test(err.message) || /no column/i.test(err.message);
}

function attemptLegacyMigration(runtime) {
  if (!legacyMigrationPending || !runtime.confirmed) return;

  try {
    const database = db();
    const exists = database
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=@table LIMIT 1")
      .get({ table: runtime.table });

    if (!exists) {
      return;
    }

    const updates = [
      { from: 'pendente', to: 'pending' },
      { from: 'em_andamento', to: 'in_progress' },
      { from: 'resolvido', to: 'resolved' },
    ];

    const updateStmt = database.prepare(`
      UPDATE ${runtime.table}
         SET ${runtime.statusColumn} = @to
       WHERE ${runtime.statusColumn} = @from
    `);

    for (const pair of updates) {
      updateStmt.run(pair);
    }
  } catch (err) {
    console.warn('[message:model] Falha ao migrar status legados:', err.message);
  } finally {
    legacyMigrationPending = false;
  }
}

function withRuntime(callback) {
  let lastError;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt === 1) {
      resetRuntime();
    }

    const runtime = getRuntime();
    attemptLegacyMigration(runtime);

    try {
      return callback(runtime);
    } catch (err) {
      lastError = err;
      if (attempt === 0 && shouldRetryError(err)) {
        continue;
      }
      throw err;
    }
  }

  throw lastError;
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
  runtime,
  whereClause = '',
  orderClause,
  limitClause = 'LIMIT @limit OFFSET @offset'
) {
  const orderSegment = orderClause || `ORDER BY ${runtime.idColumn} DESC`;
  return `
    SELECT
      ${runtime.selectColumns}
      FROM ${runtime.table}
      ${whereClause}
      ${orderSegment}
      ${limitClause}
  `;
}

function create(payload) {
  return withRuntime(runtime => {
    const normalizedPayload = normalizePayload(payload);
    const timestamps = attachTimestamps({}, payload);
    const data = {
      ...normalizedPayload.data,
      status: normalizedPayload.statusProvided && normalizedPayload.data.status
        ? normalizedPayload.data.status
        : 'pending',
    };

    const info = db().prepare(`
      INSERT INTO ${runtime.table} (
        ${runtime.insertColumns}
      ) VALUES (
        ${runtime.insertValues}
      )
    `).run({ ...data, ...timestamps });

    return info.lastInsertRowid;
  });
}

function findById(id) {
  return withRuntime(runtime => {
    const row = db().prepare(`
      SELECT
        ${runtime.selectColumns}
        FROM ${runtime.table}
       WHERE ${runtime.idColumn} = @id
       LIMIT 1
    `).get({ id });
    return mapRow(row);
  });
}

function update(id, payload) {
  return withRuntime(runtime => {
    const normalizedPayload = normalizePayload(payload);
    const info = db().prepare(`
      UPDATE ${runtime.table}
         SET ${runtime.column('call_date')}     = @call_date,
             ${runtime.column('call_time')}     = @call_time,
             ${runtime.column('recipient')}     = @recipient,
             ${runtime.column('sender_name')}   = @sender_name,
             ${runtime.column('sender_phone')}  = @sender_phone,
             ${runtime.column('sender_email')}  = @sender_email,
             ${runtime.column('subject')}       = @subject,
             ${runtime.column('message')}       = @message,
             ${runtime.statusColumn}           = COALESCE(@status, ${runtime.statusColumn}),
             ${runtime.column('callback_time')} = @callback_time,
             ${runtime.column('notes')}         = @notes,
             ${runtime.column('updated_at')}    = datetime('now')
       WHERE ${runtime.idColumn} = @id
    `).run({
      id,
      ...normalizedPayload.data,
      status: normalizedPayload.statusProvided ? normalizedPayload.data.status : null,
    });

    return info.changes > 0;
  });
}

function updateStatus(id, status) {
  return withRuntime(runtime => {
    const normalized = ensureStatus(status);
    const info = db().prepare(`
      UPDATE ${runtime.table}
         SET ${runtime.statusColumn}        = @status,
             ${runtime.column('updated_at')} = datetime('now')
       WHERE ${runtime.idColumn} = @id
    `).run({ id, status: normalized });
    return info.changes > 0;
  });
}

function remove(id) {
  return withRuntime(runtime => {
    const info = db().prepare(`DELETE FROM ${runtime.table} WHERE ${runtime.idColumn} = @id`).run({ id });
    return info.changes > 0;
  });
}

function list({ limit = 10, offset = 0, status, start_date, end_date, recipient } = {}) {
  return withRuntime(runtime => {
    const parsedLimit = Number(limit);
    const parsedOffset = Number(offset);
    const sanitizedLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 200) : 10;
    const sanitizedOffset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;
    const statusFilter = translateStatusForQuery(status);

    const startDate = trim(start_date);
    const endDate = trim(end_date);
    const recipientFilter = trim(recipient);
    const effectiveDateColumn = `COALESCE(NULLIF(TRIM(${runtime.callDateColumn}), ''), ${runtime.createdAtColumn})`;

    const conditions = [];
    const params = {
      limit: sanitizedLimit,
      offset: sanitizedOffset,
    };

    if (statusFilter) {
      conditions.push(`${runtime.statusColumn} IN (@status, @legacy)`);
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
      conditions.push(`LOWER(COALESCE(TRIM(${runtime.recipientColumn}), '')) LIKE @recipient`);
      params.recipient = `%${recipientFilter.toLowerCase()}%`;
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = selectBase(runtime, whereClause);
    const rows = db().prepare(query).all(params);

    return rows.map(mapRow);
  });
}

function listRecent(limit = 10) {
  return list({ limit });
}

function stats() {
  return withRuntime(runtime => {
    const database = db();
    const total = database.prepare(`SELECT COUNT(*) AS count FROM ${runtime.table}`).get().count;

    const counters = {};
    for (const status of STATUS_VALUES) {
      const legacy = STATUS_EN_TO_PT[status];
      const row = database.prepare(`
        SELECT COUNT(*) AS count
          FROM ${runtime.table}
         WHERE ${runtime.statusColumn} IN (@status, @legacy)
      `).get({ status, legacy });
      counters[status] = row.count;
    }

    return {
      total,
      pending: counters.pending || 0,
      in_progress: counters.in_progress || 0,
      resolved: counters.resolved || 0,
    };
  });
}

function migrateLegacyStatuses() {
  withRuntime(() => {});
}

function sanitizeLimit(limit, { fallback = 10, max = 100 } = {}) {
  const parsed = Number(limit);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.min(Math.floor(parsed), max);
  }
  return fallback;
}

function statsByRecipient({ limit = 10 } = {}) {
  return withRuntime(runtime => {
    const sanitizedLimit = sanitizeLimit(limit, { fallback: 10, max: 100 });
    const rows = db().prepare(`
      SELECT
        COALESCE(NULLIF(TRIM(${runtime.recipientColumn}), ''), 'Não informado') AS recipient,
        COUNT(*) AS count
        FROM ${runtime.table}
    GROUP BY recipient
    ORDER BY count DESC, recipient ASC
       LIMIT @limit
    `).all({ limit: sanitizedLimit });

    return rows.map(row => ({ recipient: row.recipient, count: row.count }));
  });
}

function statsByStatus() {
  return withRuntime(runtime => {
    const totals = STATUS_VALUES.reduce((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {});

    const rows = db().prepare(`
      SELECT
        ${runtime.statusColumn} AS raw_status,
        COUNT(*)         AS count
        FROM ${runtime.table}
    GROUP BY ${runtime.statusColumn}
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
  });
}

function statsByMonth({ limit = 12 } = {}) {
  return withRuntime(runtime => {
    const sanitizedLimit = sanitizeLimit(limit, { fallback: 12, max: 120 });
    const rows = db().prepare(`
      WITH aggregated AS (
        SELECT
          strftime('%Y-%m', CASE
            WHEN ${runtime.callDateColumn} IS NOT NULL AND TRIM(${runtime.callDateColumn}) != ''
              THEN ${runtime.callDateColumn}
            ELSE ${runtime.createdAtColumn}
          END) AS month,
          COUNT(*) AS count
          FROM ${runtime.table}
      GROUP BY month
        HAVING month IS NOT NULL
      )
      SELECT month, count
        FROM aggregated
    ORDER BY month DESC
       LIMIT @limit
    `).all({ limit: sanitizedLimit });

    return rows.reverse().map(row => ({ month: row.month, count: row.count }));
  });
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
