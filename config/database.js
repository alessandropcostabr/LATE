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

// Helper para boolean
const asBool = (v) => ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());

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

const pool = new Pool(pgConfig);
pool.on('error', (err) => {
  console.error('[db] Erro no cliente idle do PostgreSQL:', err);
});

module.exports = pool;

