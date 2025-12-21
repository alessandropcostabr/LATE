// models/message/schema.js

const db = require('../../config/database');
const {
  TABLE_NAME,
  RECIPIENT_USER_COLUMN,
  RECIPIENT_SECTOR_COLUMN,
  CREATED_BY_COLUMN,
  UPDATED_BY_COLUMN,
  USER_SECTORS_TABLE,
  PARENT_MESSAGE_COLUMN,
  BASE_SELECT_FIELDS,
  OPTIONAL_COLUMNS,
} = require('./constants');

const BENCH_ALERTS_VERBOSE = ['1', 'true', 'yes', 'on'].includes(String(process.env.BENCH_ALERTS_VERBOSE || '').toLowerCase());
const BENCH_ALERTS_SKIP_SCHEMA = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.BENCH_ALERTS_SKIP_SCHEMA || '').toLowerCase()
);

function benchListLog(...args) {
  if (BENCH_ALERTS_VERBOSE) {
    console.info('[bench-alerts][message.list]', ...args);
  }
}

let recipientSectorFeatureDisabled = false;

const columnSupportCache = new Map();
const columnCheckPromises = new Map();

const tableSupportCache = new Map();
const tableCheckPromises = new Map();

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

function isRecipientSectorFeatureEnabled() {
  return !recipientSectorFeatureDisabled;
}

async function supportsRecipientSectorColumn() {
  return !recipientSectorFeatureDisabled && await supportsColumn(RECIPIENT_SECTOR_COLUMN);
}

module.exports = {
  handleSchemaError,
  isRecipientSectorFeatureEnabled,
  resolveSelectColumns,
  supportsColumn,
  supportsRecipientSectorColumn,
  supportsTable,
  supportsUserSectorsTable,
};
