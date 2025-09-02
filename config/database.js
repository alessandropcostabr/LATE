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
    if (!this.db) {
      const dbPath = path.join(__dirname, '..', 'data', 'recados.db');
      this.db = new Database(dbPath);
      // Habilitar chaves estrangeiras, se necessário
      this.db.pragma('foreign_keys = ON');
    }
    return this.db;
  }

  /**
   * Encerra a conexão com o banco. Útil para desligamento gracioso.
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

module.exports = new DatabaseManager();
