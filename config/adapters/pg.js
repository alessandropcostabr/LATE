// config/adapters/pg.js
// Adapter PostgreSQL (pg/Pool) com helpers de placeholder, transação e wrapper homogêneo.

const { Pool } = require('pg');

class PostgresAdapter {
  constructor() {
    this.pool = null;
    this.config = {};
    this.name = 'pg';
  }

  configure(config = {}) {
    this.config = { ...config };
    // Dica: se existir PG_CONNECTION_STRING nas envs, você pode preferir connectionString.
    if (!this.config.connectionString && process.env.PG_CONNECTION_STRING) {
      this.config.connectionString = process.env.PG_CONNECTION_STRING;
    }
  }

  // Placeholder parametrizado por índice ($1, $2, ...)
  placeholder(index) {
    return `$${index}`;
  }

  // Gera N placeholders a partir de 'start' para composições (INSERT multi-coluna, etc.).
  formatPlaceholders(count, start = 1) {
    return Array.from({ length: count }, (_, i) => `$${i + start}`).join(', ');
  }

  ensurePool() {
    if (!this.pool) {
      this.pool = new Pool(this.config);
    }
    return this.pool;
  }

  // Cria um statement com coletor de parâmetros flexível (array, objeto simples, lista).
  createStatement(executor, sql) {
    const collectParams = (args) => {
      if (!args || args.length === 0) return [];
      if (args.length === 1) {
        const [first] = args;
        if (Array.isArray(first)) return first;
        if (first && typeof first === 'object' && !(first instanceof Date)) {
          return Object.values(first);
        }
        return [first];
      }
      return Array.from(args);
    };

    return {
      run: async (...params) => {
        const result = await executor.query(sql, collectParams(params));
        return {
          changes: result.rowCount,
          lastInsertId: result.rows?.[0]?.id ?? null,
          rows: result.rows || [],
        };
      },
      get: async (...params) => {
        const result = await executor.query(sql, collectParams(params));
        return result.rows?.[0] ?? null;
      },
      all: async (...params) => {
        const result = await executor.query(sql, collectParams(params));
        return result.rows || [];
      },
    };
  }

  getDatabase() {
    const pool = this.ensurePool();
    return {
      prepare: (sql) => this.createStatement(pool, sql),
      exec: (sql) => pool.query(sql),
    };
  }

  async transaction(callback) {
    const pool = this.ensurePool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const wrapper = {
        prepare: (sql) => this.createStatement(client, sql),
        exec: (sql) => client.query(sql),
      };
      const result = await callback(wrapper);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async close() {
    if (!this.pool) return;
    const pool = this.pool;
    this.pool = null;
    await pool.end();
  }
}

module.exports = new PostgresAdapter();
