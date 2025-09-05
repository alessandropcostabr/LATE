const dbManager = require('../config/database');

class UserModel {
  constructor() {
    this.db = dbManager.getDatabase();
    this._init();
  }

  _init() {
    if (!this.db || !this.db.open) {
      throw new Error('Database connection is not initialized');
    }
    this.db.prepare(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'USER',
      active INTEGER NOT NULL DEFAULT 1,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run();
  }

  findByUsername(username) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username);
  }

  findAll() {
    const stmt = this.db.prepare('SELECT id, username, role, active FROM users');
    return stmt.all();
  }

  create(user) {
    const stmt = this.db.prepare('INSERT INTO users (username, password, role, active) VALUES (?, ?, ?, 1)');
    const result = stmt.run(user.username, user.password, user.role || 'USER');
    return { id: result.lastInsertRowid, username: user.username, role: user.role || 'USER', active: 1 };
  }

  setActive(id, active) {
    const stmt = this.db.prepare('UPDATE users SET active = ? WHERE id = ?');
    const result = stmt.run(active ? 1 : 0, id);
    return result.changes > 0;
  }
}

module.exports = new UserModel();
