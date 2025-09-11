const dbManager = require('../config/database');

class UserModel {
  constructor() {
    this.db = dbManager.getDatabase();
    this._init();
  }

  _init() {
    this._ensureDb();
    this.db.prepare(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'OPERADOR' CHECK (role IN ('ADMIN','SUPERVISOR','OPERADOR','LEITOR')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run();
  }

  _ensureDb() {
    if (!this.db || !this.db.open) {
      throw new Error('Database connection is not initialized');
    }
  }

  findByEmail(email) {
    this._ensureDb();
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email);
  }

  create(user) {
    this._ensureDb();
    const stmt = this.db.prepare(`
      INSERT INTO users (name, email, password_hash, role, is_active)
      VALUES (?, ?, ?, ?, 1)
    `);
    const result = stmt.run(
      user.name,
      user.email,
      user.password_hash,
      user.role || 'OPERADOR'
    );
    return {
      id: result.lastInsertRowid,
      name: user.name,
      email: user.email,
      role: user.role || 'OPERADOR',
      is_active: 1,
    };
  }

  list({ q = '', page = 1, limit = 10 } = {}) {
    this._ensureDb();

    // Determine available timestamp columns
    const columns = this.db.prepare('PRAGMA table_info(users)').all();
    const hasCreatedAt = columns.some((c) => c.name === 'created_at');
    const hasUpdatedAt = columns.some((c) => c.name === 'updated_at');
    const hasCriadoEm = columns.some((c) => c.name === 'criado_em');

    const selectCols = ['id', 'name', 'email', 'role', 'is_active'];
    if (hasCreatedAt) {
      selectCols.push('created_at');
    } else if (hasCriadoEm) {
      selectCols.push('criado_em AS created_at');
    }
    if (hasUpdatedAt) {
      selectCols.push('updated_at');
    }
    const selectClause = selectCols.join(', ');

    const offset = (page - 1) * limit;
    const params = [];
    let where = '';
    if (q) {
      where = 'WHERE name LIKE ? OR email LIKE ?';
      const term = `%${q}%`;
      params.push(term, term);
    }
    const dataStmt = this.db.prepare(`
      SELECT ${selectClause}
      FROM users
      ${where}
      ORDER BY name ASC
      LIMIT ? OFFSET ?
    `);
    const data = dataStmt.all(...params, limit, offset);
    const countStmt = this.db.prepare(`SELECT COUNT(*) as total FROM users ${where}`);
    const { total } = countStmt.get(...params);
    return {
      data,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  }

  setActive(id, active) {
    this._ensureDb();
    const stmt = this.db.prepare(
      'UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    );
    const result = stmt.run(active ? 1 : 0, id);
    return result.changes > 0;
  }
}

module.exports = new UserModel();
