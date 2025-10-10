// config/database.js
// Conexão com PostgreSQL (PG only). Mensagens em pt-BR; identificadores em inglês.

const path = require('path');
const dotenv = require('dotenv');

// Carrega somente .env do projeto; em produção você pode injetar envs via PM2/systemd.
dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true });
console.info('[db] Env carregado de: .env');

// Fail-fast: somente PostgreSQL é suportado
const driver = String(process.env.DB_DRIVER || 'pg').toLowerCase();
if (driver !== 'pg') {
  throw new Error('Configuração inválida: somente PostgreSQL é suportado. Defina DB_DRIVER=pg no .env');
}

const { Pool } = require('pg');

// Aceita PG_* (padrão do projeto) e PG* (padrão do cliente psql)
const pgConfig = {
  host:     process.env.PG_HOST     || process.env.PGHOST     || '127.0.0.1',
  port:    (process.env.PG_PORT     || process.env.PGPORT     || 5432) * 1,
  user:     process.env.PG_USER     || process.env.PGUSER,
  password: process.env.PG_PASSWORD || process.env.PGPASSWORD,
  database: process.env.PG_DATABASE || process.env.PGDATABASE,
  ssl:      ['1','true','yes','on'].includes(String(process.env.PG_SSL).toLowerCase())
             ? { rejectUnauthorized: false } : false,
};

// Aviso útil (sem vazar segredos)
if (!pgConfig.user || !pgConfig.password || !pgConfig.database) {
  console.error('[db] Variáveis PG_* ausentes. Verifique PG_USER, PG_PASSWORD e PG_DATABASE.');
}

function createPool() {
  if (typeof global.__LATE_POOL_FACTORY === 'function') {
    return global.__LATE_POOL_FACTORY();
  }
  return new Pool(pgConfig);
}

const pool = createPool();

pool.on?.('error', (err) => {
  console.error('[db] Erro no cliente idle do PostgreSQL:', err);
});

const placeholder = (i) => `$${i}`;

let databaseProxy;

async function execStatements(sql) {
  const text = String(sql || '').trim();
  if (!text) return [];

  const statements = text
    .split(/;(?:\s*[\r\n]+|\s*$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);

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
    async run(params = []) {
      await pool.query(text, params);
    },
    async get(params = []) {
      const { rows } = await pool.query(text, params);
      return rows[0];
    },
    async all(params = []) {
      const { rows } = await pool.query(text, params);
      return rows;
    },
  };
}

function getDatabase() {
  if (global.__LATE_DB_INSTANCE) {
    return global.__LATE_DB_INSTANCE;
  }
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
  if (typeof pool.end === 'function') {
    await pool.end();
  }
}

pool.getDatabase = getDatabase;
pool.close = close;
pool.placeholder = placeholder;

module.exports = pool;
