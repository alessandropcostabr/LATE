// models/user.js
// User model using DatabaseManager helper (SQLite / ready for PG adapter).
// Table: users (id, name, email, password_hash, role, is_active, created_at, updated_at)

const databaseManager = require('../config/database');

function db() {
  return databaseManager.getDatabase();
}

class UserModel {
  constructor() {
    this._init();
  }

  _init() {
    // Guarantees table; aligns with your current schema (English)
    db().prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'OPERADOR' CHECK (role IN ('ADMIN','SUPERVISOR','OPERADOR','LEITOR')),
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  }

  _normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  findByEmail(email) {
    const row = db().prepare(`
      SELECT id, name, email, password_hash, role, is_active, created_at, updated_at
        FROM users
       WHERE email = ?
       LIMIT 1
    `).get(this._normalizeEmail(email));
    if (!row) return null;
    // safety booleans
    row.is_active = Boolean(row.is_active);
    return row;
  }

  findById(id) {
    const row = db().prepare(`
      SELECT id, name, email, role, is_active, created_at, updated_at
        FROM users
       WHERE id = ?
    `).get(id);
    if (!row) return null;
    row.is_active = Boolean(row.is_active);
    return row;
  }

  create({ name, email, password_hash, role = 'OPERADOR' }) {
    const info = db().prepare(`
      INSERT INTO users (name, email, password_hash, role, is_active, created_at, updated_at)
      VALUES (@name, LOWER(@email), @password_hash, @role, 1,
              COALESCE(@created_at, CURRENT_TIMESTAMP),
              COALESCE(@updated_at, CURRENT_TIMESTAMP))
    `).run({
      name: String(name || '').trim(),
      email: this._normalizeEmail(email),
      password_hash,
      role: String(role || 'OPERADOR').trim().toUpperCase(),
    });

    return {
      id: info.lastInsertRowid,
      name: String(name || '').trim(),
      email: this._normalizeEmail(email),
      role: String(role || 'OPERADOR').trim().toUpperCase(),
      is_active: true,
    };
  }

  updatePassword(id, password_hash) {
    const info = db().prepare(`
      UPDATE users
         SET password_hash = @password_hash,
             updated_at = CURRENT_TIMESTAMP
       WHERE id = @id
    `).run({ id, password_hash });
    return info.changes > 0;
  }

  setActive(id, active) {
    const info = db().prepare(`
      UPDATE users
         SET is_active = @active,
             updated_at = CURRENT_TIMESTAMP
       WHERE id = @id
    `).run({ id, active: active ? 1 : 0 });
    return info.changes > 0;
  }

  list({ q = '', page = 1, limit = 10 } = {}) {
    const offset = (page - 1) * limit;
    let where = '';
    const params = [];

    if (q) {
      where = 'WHERE name LIKE ? OR email LIKE ?';
      const term = `%${q}%`;
      params.push(term, term);
    }

    const rows = db().prepare(`
      SELECT id, name, email, role, is_active, created_at, updated_at
        FROM users
        ${where}
    ORDER BY name ASC
       LIMIT ? OFFSET ?
    `).all(...params, limit, offset).map(u => ({ ...u, is_active: Boolean(u.is_active) }));

    const { total } = db().prepare(`
      SELECT COUNT(*) AS total FROM users ${where}
    `).get(...params);

    return {
      data: rows,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) }
    };
  }
}

module.exports = new UserModel();

