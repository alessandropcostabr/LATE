const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

/**
 * Gerenciador simples para conexão com SQLite utilizando better‑sqlite3.
 * A instância do banco é criada uma única vez e reutilizada.
 */
class DatabaseManager {
  constructor() {
    this.db = null;
  }

  /**
   * Retorna uma instância única do banco. Cria o arquivo se não existir.
   */
  getDatabase() {
    if (!this.db || !this.db.open) {
      const isTest = process.env.NODE_ENV === 'test';
      const defaultPath = isTest
        ? ':memory:'
        : path.join(__dirname, '..', 'data', 'recados.db');
      const envPath = process.env.DB_PATH && process.env.DB_PATH.trim() !== ''
        ? process.env.DB_PATH
        : defaultPath;

      if (envPath !== ':memory:') {
        fs.mkdirSync(path.dirname(envPath), { recursive: true });
      }

      try {
        console.info(`[DatabaseManager] Inicializando banco em ${envPath}`);
        this.db = new Database(envPath);
        // Habilitar chaves estrangeiras, se necessário
        this.db.pragma('foreign_keys = ON');
      } catch (err) {
        console.error(
          `[DatabaseManager] Falha ao inicializar o banco em ${envPath}: ${err.message}`,
          err
        );
        this.db = null;
        throw err;
      }
    }
    return this.db;
  }

  /**
   * Encerra a conexão com o banco. Útil para desligamento gracioso.
   */
  close() {
    if (this.db) {
      try {
        this.db.close();
      } catch (err) {
        console.error('Erro ao fechar o banco de dados:', err);
      } finally {
        this.db = null;
      }
    }
  }
}

module.exports = new DatabaseManager();
