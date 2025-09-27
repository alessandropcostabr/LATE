const path = require('path');
const sqliteAdapter = require('./adapters/sqlite');
const pgAdapter = require('./adapters/pg');

let activeAdapter = null;

function parsePgSsl(value) {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  if (!trimmed) return undefined;
  const normalized = trimmed.toLowerCase();
  if (['0', 'false', 'off', 'no', 'disable'].includes(normalized)) {
    return undefined;
  }
  if (normalized === 'strict' || normalized === 'verify') {
    return { rejectUnauthorized: true };
  }
  if (normalized.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      return parsed;
    } catch (err) {
      console.warn('[database] Failed to parse PG_SSL JSON value. Falling back to insecure mode.');
      return { rejectUnauthorized: false };
    }
  }
  return { rejectUnauthorized: false };
}

function configureSqliteAdapter(adapter) {
  const isTest = process.env.NODE_ENV === 'test';
  const defaultPath = isTest
    ? ':memory:'
    : path.join(__dirname, '..', 'data', 'recados.db');
  const filename = process.env.DB_PATH && process.env.DB_PATH.trim() !== ''
    ? process.env.DB_PATH
    : defaultPath;
  adapter.configure({ filename });
  return adapter;
}

function configurePgAdapter(adapter) {
  const config = {
    host: process.env.PG_HOST || undefined,
    port: process.env.PG_PORT ? Number(process.env.PG_PORT) : undefined,
    user: process.env.PG_USER || undefined,
    password: process.env.PG_PASSWORD || undefined,
    database: process.env.PG_DATABASE || undefined,
  };
  const ssl = parsePgSsl(process.env.PG_SSL);
  if (ssl) {
    config.ssl = ssl;
  }
  adapter.configure(config);
  return adapter;
}

function selectAdapter() {
  if (activeAdapter) {
    return activeAdapter;
  }

  const driver = (process.env.DB_DRIVER || 'sqlite').trim().toLowerCase();
  if (driver === 'pg') {
    activeAdapter = configurePgAdapter(pgAdapter);
  } else {
    activeAdapter = configureSqliteAdapter(sqliteAdapter);
  }

  return activeAdapter;
}

function db() {
  return selectAdapter().getDatabase();
}

function placeholder(index = 1) {
  return selectAdapter().placeholder(index);
}

function formatPlaceholders(count, start = 1) {
  const adapter = selectAdapter();
  if (typeof adapter.formatPlaceholders === 'function') {
    return adapter.formatPlaceholders(count, start);
  }
  return Array.from({ length: count }, (_, i) => adapter.placeholder(i + start)).join(', ');
}

function transaction(callback) {
  const adapter = selectAdapter();
  if (typeof adapter.transaction !== 'function') {
    throw new Error('The current database adapter does not support transactions.');
  }
  return adapter.transaction(callback);
}

async function close() {
  if (!activeAdapter) return;
  const adapter = activeAdapter;
  activeAdapter = null;
  if (typeof adapter.close === 'function') {
    await adapter.close();
  }
}

module.exports = {
  db,
  getDatabase: db,
  placeholder,
  formatPlaceholders,
  transaction,
  close,
  adapter: () => selectAdapter(),
};
