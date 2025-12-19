// __tests__/setup/pgmem.js
// Usa pg-mem para evitar conexão real ao PostgreSQL nos testes.
const { newDb } = require('pg-mem');

// Evita warning de PG_* ausentes no config/database.js
process.env.PG_USER = process.env.PG_USER || 'mem';
process.env.PG_PASSWORD = process.env.PG_PASSWORD || 'mem';
process.env.PG_DATABASE = process.env.PG_DATABASE || 'mem';
process.env.PG_HOST = process.env.PG_HOST || '127.0.0.1';
process.env.PG_PORT = process.env.PG_PORT || '5432';

beforeAll(() => {
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  const { Pool } = mem.adapters.createPg();
  // Hook usado em config/database.js
  global.__LATE_POOL_FACTORY = () => new Pool();
});

afterAll(() => {
  delete global.__LATE_POOL_FACTORY;
});
