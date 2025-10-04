// config/database.js
// Database Manager — seleciona adapter por DB_DRIVER (pg|sqlite) e expõe helpers neutros.
// Comentários em pt-BR; identificadores em inglês.

const path = require('path');
const sqliteAdapter = require('./adapters/sqlite');
const pgAdapter = require('./adapters/pg');

let activeAdapter = null;

// Lê a primeira env não-vazia dentre as fornecidas.
function pick(...keys) {
  for (const k of keys) {
    const v = process.env[k];
    if (v !== undefined && String(v).trim() !== '') return v;
  }
  return undefined;
}

// Normaliza configuração de SSL do PG a partir de env (PG_SSL).
function parsePgSsl(value) {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  if (!trimmed) return undefined;
  const normalized = trimmed.toLowerCase();
  if (['0', 'false', 'off', 'no', 'disable'].includes(normalized)) return undefined;
  if (normalized === 'strict' || normalized === 'verify') return { rejectUnauthorized: true };
  if (normalized.startsWith('{')) {
    try { return JSON.parse(trimmed); } catch (_e) {
      console.warn('[database] Falha ao parsear PG_SSL como JSON. Caindo para modo não-estrito.');
      return { rejectUnauthorized: false };
    }
  }
  return { rejectUnauthorized: false };
}

// SQLite (arquivo em data/ ou :memory: em testes).
function configureSqliteAdapter(adapter) {
  const isTest = process.env.NODE_ENV === 'test';
  const defaultPath = isTest ? ':memory:' : path.join(__dirname, '..', 'data', 'recados.db');
  const filename = pick('DB_PATH') || defaultPath;
  adapter.configure({ filename });
  return adapter;
}

// PostgreSQL (lê ambos formatos PG_* / PG* para robustez).
function configurePgAdapter(adapter) {
  const config = {
    host: pick('PG_HOST', 'PGHOST'),
    port: pick('PG_PORT', 'PGPORT') ? Number(pick('PG_PORT', 'PGPORT')) : undefined,
    user: pick('PG_USER', 'PGUSER'),
    password: pick('PG_PASSWORD', 'PGPASSWORD'),
    database: pick('PG_DATABASE', 'PGDATABASE'),
  };
  const ssl = parsePgSsl(process.env.PG_SSL);
  if (ssl) config.ssl = ssl;
  // Se existir connection string completa, o adapter de PG deve respeitá-la internamente.
  adapter.configure(config);
  return adapter;
}

// Seleciona e memoriza o adapter ativo com base no DB_DRIVER.
function selectAdapter() {
  if (activeAdapter) return activeAdapter;
  const driver = (process.env.DB_DRIVER || 'sqlite').trim().toLowerCase();
  if (driver === 'pg') activeAdapter = configurePgAdapter(pgAdapter);
  else                 activeAdapter = configureSqliteAdapter(sqliteAdapter);
  return activeAdapter;
}

// === API exposta aos models/controllers ===

// Retorna wrapper do banco (prepare/exec).
function db() {
  return selectAdapter().getDatabase();
}

// Helper de placeholder único: PG -> $n ; SQLite -> ?
function placeholder(index = 1) {
  return selectAdapter().placeholder(index);
}

// Gera N placeholders. Em PG respeita 'start'; em SQLite ignora.
function formatPlaceholders(count, start = 1) {
  const adapter = selectAdapter();
  if (typeof adapter.formatPlaceholders === 'function') {
    return adapter.formatPlaceholders(count, start);
  }
  return Array.from({ length: count }, (_, i) => adapter.placeholder(i + start)).join(', ');
}

// Executa função dentro de transação (PG assíncrono, SQLite síncrono).
function transaction(callback) {
  const adapter = selectAdapter();
  if (typeof adapter.transaction !== 'function') {
    throw new Error('O adapter atual não suporta transações.');
  }
  return adapter.transaction(callback);
}

// Fecha o recurso do adapter atual (útil em testes).
async function close() {
  if (!activeAdapter) return;
  const adapter = activeAdapter;
  activeAdapter = null;
  if (typeof adapter.close === 'function') {
    await adapter.close();
  }
}

// Fornece acesso ao adapter ativo (ex.: health-check).
function adapter() {
  return selectAdapter();
}

module.exports = {
  db,
  getDatabase: db, // alias para compatibilidade
  placeholder,
  formatPlaceholders,
  transaction,
  close,
  adapter,
};
