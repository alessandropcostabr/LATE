// config/database.js
// DB Manager que seleciona o adapter via DB_DRIVER (pg|sqlite) e expõe helpers neutros.
// Comentários em pt-BR para logs/erros visíveis; identificadores em inglês.

const path = require('path');
const sqliteAdapter = require('./adapters/sqlite');
const pgAdapter = require('./adapters/pg');

let activeAdapter = null;

// Normaliza configuração de SSL do PG a partir de env (PG_SSL).
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
      return JSON.parse(trimmed);
    } catch (err) {
      console.warn('[database] Falha ao parsear PG_SSL como JSON. Caindo para modo não-estrito.');
      return { rejectUnauthorized: false };
    }
  }
  return { rejectUnauthorized: false };
}

// Configuração padrão do SQLite (arquivo em data/ ou :memory: em testes).
function configureSqliteAdapter(adapter) {
  const isTest = process.env.NODE_ENV === 'test';
  const defaultPath = isTest ? ':memory:' : path.join(__dirname, '..', 'data', 'recados.db');
  const filename = process.env.DB_PATH && process.env.DB_PATH.trim() !== ''
    ? process.env.DB_PATH
    : defaultPath;
  adapter.configure({ filename });
  return adapter;
}

// Configuração do PostgreSQL a partir de variáveis PG_*.
function configurePgAdapter(adapter) {
  const config = {
    host: process.env.PG_HOST || undefined,
    port: process.env.PG_PORT ? Number(process.env.PG_PORT) : undefined,
    user: process.env.PG_USER || undefined,
    password: process.env.PG_PASSWORD || undefined,
    database: process.env.PG_DATABASE || undefined,
  };
  const ssl = parsePgSsl(process.env.PG_SSL);
  if (ssl) config.ssl = ssl;
  // Se existir connection string completa, o adapter de PG irá considerar no configure().
  adapter.configure(config);
  return adapter;
}

// Seleciona e memoriza o adapter ativo com base no DB_DRIVER.
function selectAdapter() {
  if (activeAdapter) return activeAdapter;

  const driver = (process.env.DB_DRIVER || 'sqlite').trim().toLowerCase();
  if (driver === 'pg') {
    activeAdapter = configurePgAdapter(pgAdapter);
  } else {
    activeAdapter = configureSqliteAdapter(sqliteAdapter);
  }
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

// Helper para gerar N placeholders. Em PG respeita 'start'.
// Em SQLite ignora 'start' (mas preserva a assinatura).
function formatPlaceholders(count, start = 1) {
  const adapter = selectAdapter();
  if (typeof adapter.formatPlaceholders === 'function') {
    return adapter.formatPlaceholders(count, start);
  }
  // Fallback teórico (todos adapters atuais implementam formatPlaceholders).
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
  getDatabase: db,       // alias para compatibilidade retro
  placeholder,
  formatPlaceholders,
  transaction,
  close,
  adapter,
};
