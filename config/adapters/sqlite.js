// config/adapters/sqlite.js
// Adapter SQLite (better-sqlite3) com helpers de placeholder e transação.
// Comentários em pt-BR; identificadores em inglês (padrão do projeto).

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

  // Permite configurar caminho do arquivo/banco em memória.
  configure(config = {}) {
    this.config = { ...config };
  }

  // Placeholder neutro para SQLite (ignora índice).
  placeholder(/* index */) {
    return '?';
  }

  // Gera N placeholders. Suporta 'start' por compatibilidade de assinatura.
  formatPlaceholders(count, start = 1) {
    // Em SQLite o 'start' não altera o placeholder, mas mantemos a assinatura
    // para ser 100% compatível com o DB Manager.
    return Array.from({ length: count }, () => '?').join(', ');
  }

  ensureConnection() {
    if (this.connection && this.connection.open) {
      return this.connection;
    }

    const isTest = process.env.NODE_ENV === 'test';
    const defaultPath = isTest ? ':memory:' : path.join(__dirname, '..', '..', 'data', 'recados.db');
    const filename = this.config.filename || defaultPath;

    if (filename !== ':memory:') {
      fs.mkdirSync(path.dirname(filename), { recursive: true });
    }

    try {
      console.info(`[SqliteAdapter] Opening database at ${filename}`);
      this.connection = new Database(filename);
      // Habilita FKs no SQLite.
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

  // Retorna uma interface homogênea (prepare/exec) similar ao PG adapter.
  getDatabase() {
    const connection = this.ensureConnection();
    if (this.wrapper) {
      return this.wrapper;
    }

    // Normaliza passagem de parâmetros: aceita lista, array único ou objeto simples.
    const applyParams = (method, args) => {
      if (!args || args.length === 0) {
        return method();
      }
      if (args.length === 1) {
        const [first] = args;
        if (Array.isArray(first)) return method(...first);
        return method(first);
      }
      return method(...args);
    };

    this.wrapper = {
      prepare: (sql) => {
        const statement = connection.prepare(sql);
        return {
          // Retorna shape compatível: { changes, lastInsertId, rows }
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
      exec: (sql) => connection.exec(sql),
    };

    return this.wrapper;
  }

  // Transação síncrona (better-sqlite3 não suporta callback async dentro de .transaction()).
  transaction(callback) {
    const connection = this.ensureConnection();
    const tx = connection.transaction((...args) => {
      const result = callback(this.getDatabase(), ...args);
      if (isPromise(result)) {
        throw new Error('SQLite adapter não suporta callbacks assíncronos dentro de transações.');
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
