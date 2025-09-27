const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function isPromise(value) {
  return value && typeof value.then === 'function';
}

class SqliteAdapter {
  constructor() {
    this.connection = null;
    this.wrapper = null;
    this.config = {};
    this.name = 'sqlite';
  }

  configure(config = {}) {
    this.config = { ...config };
  }

  placeholder() {
    return '?';
  }

  formatPlaceholders(count) {
    return Array.from({ length: count }, () => '?').join(', ');
  }

  ensureConnection() {
    if (this.connection && this.connection.open) {
      return this.connection;
    }

    const isTest = process.env.NODE_ENV === 'test';
    const defaultPath = isTest
      ? ':memory:'
      : path.join(__dirname, '..', '..', 'data', 'recados.db');
    const filename = this.config.filename || defaultPath;

    if (filename !== ':memory:') {
      fs.mkdirSync(path.dirname(filename), { recursive: true });
    }

    try {
      console.info(`[SqliteAdapter] Opening database at ${filename}`);
      this.connection = new Database(filename);
      this.connection.pragma('foreign_keys = ON');
      this.wrapper = null;
    } catch (err) {
      console.error(`[SqliteAdapter] Failed to open database at ${filename}: ${err.message}`);
      this.connection = null;
      this.wrapper = null;
      throw err;
    }

    return this.connection;
  }

  getDatabase() {
    const connection = this.ensureConnection();
    if (this.wrapper) {
      return this.wrapper;
    }

    const applyParams = (method, args) => {
      if (!args || args.length === 0) {
        return method();
      }
      if (args.length === 1) {
        const [first] = args;
        if (Array.isArray(first)) {
          return method(...first);
        }
        return method(first);
      }
      return method(...args);
    };

    this.wrapper = {
      prepare: sql => {
        const statement = connection.prepare(sql);
        return {
          run: (...params) => {
            const result = applyParams(statement.run.bind(statement), params);
            return {
              changes: result.changes,
              lastInsertId: result.lastInsertRowid ?? null,
              rows: [],
            };
          },
          get: (...params) => applyParams(statement.get.bind(statement), params) || null,
          all: (...params) => applyParams(statement.all.bind(statement), params),
        };
      },
      exec: sql => connection.exec(sql),
    };

    return this.wrapper;
  }

  transaction(callback) {
    const connection = this.ensureConnection();
    const tx = connection.transaction((...args) => {
      const result = callback(...args);
      if (isPromise(result)) {
        throw new Error('SQLite adapter does not support async callbacks in transactions.');
      }
      return result;
    });
    return tx();
  }

  close() {
    if (!this.connection) return;
    try {
      this.connection.close();
    } catch (err) {
      console.error('[SqliteAdapter] Error while closing database connection:', err);
    } finally {
      this.connection = null;
      this.wrapper = null;
    }
  }
}

module.exports = new SqliteAdapter();
