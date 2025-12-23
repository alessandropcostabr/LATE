// config/database.js
// Conexão com PostgreSQL (PG-only). Comentários pt-BR; identificadores em inglês.

const path = require('path');

const envFile = process.env.DOTENV_FILE
  ? path.resolve(process.cwd(), process.env.DOTENV_FILE)
  : path.join(__dirname, '..', '.env');
require('dotenv').config({ path: envFile });
console.info(`[db] Env carregado de: ${path.basename(envFile)}`);

const driver = String(process.env.DB_DRIVER || 'pg').toLowerCase();
if (driver !== 'pg') {
  throw new Error('Configuração inválida: somente PostgreSQL é suportado. Defina DB_DRIVER=pg no .env');
}

const { Pool } = require('pg');

// Aceita PG_* (padrão Node) e PG* (psql/libpq)
function normalizeSslMode(raw) {
  if (raw === undefined || raw === null) return '';
  return String(raw).trim().toLowerCase();
}

function buildSslConfig() {
  const sslMode = normalizeSslMode(process.env.PG_SSL_MODE || process.env.PGSSLMODE);
  const legacySsl = ['1', 'true', 'yes', 'on', 'require'].includes(String(process.env.PG_SSL).toLowerCase());

  if (sslMode === 'disable' || sslMode === 'false' || sslMode === '0') {
    return false;
  }

  if (!sslMode && !legacySsl) {
    return false;
  }

  const rejectUnauthorizedRaw = normalizeSslMode(process.env.PG_SSL_REJECT_UNAUTHORIZED);
  const shouldVerify = sslMode.startsWith('verify');
  const rejectUnauthorized =
    rejectUnauthorizedRaw === ''
      ? shouldVerify
      : ['1', 'true', 'yes', 'on'].includes(rejectUnauthorizedRaw);

  const ssl = { rejectUnauthorized };
  if (process.env.PG_SSL_CA) ssl.ca = process.env.PG_SSL_CA;
  if (process.env.PG_SSL_CERT) ssl.cert = process.env.PG_SSL_CERT;
  if (process.env.PG_SSL_KEY) ssl.key = process.env.PG_SSL_KEY;
  return ssl;
}

const pgConfig = {
  host:     process.env.PG_HOST     || process.env.PGHOST     || '127.0.0.1',
  port:    (process.env.PG_PORT     || process.env.PGPORT     || 5432) * 1,
  user:     process.env.PG_USER     || process.env.PGUSER,
  password: process.env.PG_PASSWORD || process.env.PGPASSWORD,
  database: process.env.PG_DATABASE || process.env.PGDATABASE,
  ssl: buildSslConfig(),
};

const defaultStatementTimeout =
  process.env.NODE_ENV === 'production'
    ? Number(process.env.PG_DEFAULT_STATEMENT_TIMEOUT_MS || 60000)
    : null;

function parseTimeout(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return defaultStatementTimeout;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    console.warn('[db] Valor inválido para PG_STATEMENT_TIMEOUT_MS/STATEMENT_TIMEOUT_MS:', raw);
    return defaultStatementTimeout;
  }
  return parsed;
}

const statementTimeoutMs = parseTimeout(
  process.env.PG_STATEMENT_TIMEOUT_MS ?? process.env.STATEMENT_TIMEOUT_MS
);

if (!pgConfig.user || !pgConfig.password || !pgConfig.database) {
  console.error('[db] Variáveis PG_* ausentes. Verifique PG_USER, PG_PASSWORD e PG_DATABASE.');
}

function createPool() {
  if (typeof global.__LATE_POOL_FACTORY === 'function') return global.__LATE_POOL_FACTORY();
  return new Pool(pgConfig);
}

const pool = createPool();

if (typeof statementTimeoutMs === 'number' && statementTimeoutMs > 0) {
  const st = `SET statement_timeout TO ${statementTimeoutMs}`;
  pool.on?.('connect', (client) => client?.query(st).catch((err) => {
    console.error('[db] Falha ao definir statement_timeout:', err);
  }));
  pool.statementTimeoutMs = statementTimeoutMs;
} else if (statementTimeoutMs === 0) {
  pool.statementTimeoutMs = 0;
  if (process.env.NODE_ENV === 'production') {
    console.warn('[db] statement_timeout permanece desativado em produção; avalie PG_STATEMENT_TIMEOUT_MS.');
  }
} else {
  pool.statementTimeoutMs = null;
  if (process.env.NODE_ENV === 'production') {
    console.warn('[db] statement_timeout não configurado; usando padrão do servidor.');
  }
}

pool.on?.('error', (err) => console.error('[db] Erro no cliente idle do PostgreSQL:', err));

const placeholder = (i) => `$${i}`;

let databaseProxy;

async function execStatements(sql) {
  const text = String(sql || '').trim();
  if (!text) return [];
  const statements = text.split(/;(?:\s*[\r\n]+|\s*$)/).map(s => s.trim()).filter(Boolean);
  if (statements.length === 0) return [];

  const client = await pool.connect();
  try {
    const results = [];
    for (const statement of statements) {
      results.push(await client.query(statement));
    }
    return results;
  } finally {
    client.release();
  }
}

function prepareStatement(sql) {
  const text = String(sql || '').trim();
  return {
    text,
    async run(params = []) { await pool.query(text, params); },
    async get(params = []) { const { rows } = await pool.query(text, params); return rows[0]; },
    async all(params = []) { const { rows } = await pool.query(text, params); return rows; },
  };
}

function getDatabase() {
  if (global.__LATE_DB_INSTANCE) return global.__LATE_DB_INSTANCE;
  if (!databaseProxy) {
    databaseProxy = {
      exec: execStatements,
      prepare: prepareStatement,
      query: (...args) => pool.query(...args),
    };
  }
  return databaseProxy;
}

async function close() {
  if (typeof pool.end === 'function') await pool.end();
}

pool.getDatabase = getDatabase;
pool.close = close;
pool.placeholder = placeholder;

module.exports = pool;
