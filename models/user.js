// models/user.js

const database = require('../config/database');

function db() {
  return database.db();
}

function ph(index) {
  return database.placeholder(index);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeRole(role) {
  const allowed = ['ADMIN', 'SUPERVISOR', 'OPERADOR', 'LEITOR'];
  const value = String(role || 'OPERADOR').trim().toUpperCase();
  return allowed.includes(value) ? value : 'OPERADOR';
}

function mapRow(row) {
  if (!row) return null;
  return {
    ...row,
    // Garante boolean em ambos drivers (SQLite pode retornar 1/0)
    is_active: row.is_active === true || row.is_active === 1,
  };
}

const BASE_SELECT = `
  SELECT
    id,
    name,
    email,
    password_hash,
    role,
    is_active,
    created_at,
    updated_at
  FROM users
`;

class UserModel {
  async findByEmail(email) {
    const stmt = db().prepare(`${BASE_SELECT} WHERE LOWER(email) = LOWER(${ph(1)}) LIMIT 1`);
    const row = await stmt.get([normalizeEmail(email)]);
    return mapRow(row);
  }

  async findById(id) {
    const stmt = db().prepare(`${BASE_SELECT} WHERE id = ${ph(1)} LIMIT 1`);
    const row = await stmt.get([id]);
    return mapRow(row);
  }

  async create({ name, email, password_hash, role = 'OPERADOR' }) {
    const stmt = db().prepare(`
      INSERT INTO users (
        name,
        email,
        password_hash,
        role,
        is_active
      ) VALUES (
        ${ph(1)},
        LOWER(${ph(2)}),
        ${ph(3)},
        ${ph(4)},
        TRUE -- neutro: SQLite trata como 1; PG como boolean true
      )
      RETURNING id, name, email, role, is_active, created_at, updated_at
    `);
    const row = await stmt.get([
      String(name || '').trim(),
      normalizeEmail(email),
      password_hash,
      normalizeRole(role),
    ]);
    return mapRow(row);
  }

  async updatePassword(id, password_hash) {
    const stmt = db().prepare(`
      UPDATE users
         SET password_hash = ${ph(1)},
             updated_at = CURRENT_TIMESTAMP
       WHERE id = ${ph(2)}
    `);
    const result = await stmt.run([password_hash, id]);
    return result.changes > 0;
  }

  async setActive(id, active) {
    // Por quê: PG espera boolean; SQLite aceita 1/0, mas padronizamos como boolean.
    const value = !!active;

    const stmt = db().prepare(`
      UPDATE users
         SET is_active = ${ph(1)},
             updated_at = CURRENT_TIMESTAMP
       WHERE id = ${ph(2)}
    `);
    const result = await stmt.run([value, id]);
    return result.changes > 0;
  }

  async list({ q = '', page = 1, limit = 10 } = {}) {
    const parsedLimit = Number(limit);
    const parsedPage = Number(page);
    const sanitizedLimit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(parsedLimit, 200)) : 10;
    const sanitizedPage = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;
    const offset = (sanitizedPage - 1) * sanitizedLimit;

    const filters = [];
    const params = [];
    let index = 1;

    if (q) {
      filters.push(`(LOWER(name) LIKE ${ph(index)} OR LOWER(email) LIKE ${ph(index + 1)})`);
      const term = `%${String(q).trim().toLowerCase()}%`;
      params.push(term, term);
      index += 2;
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const rowsStmt = db().prepare(`
      ${BASE_SELECT}
      ${whereClause}
      ORDER BY name ASC
      LIMIT ${ph(index)} OFFSET ${ph(index + 1)}
    `);
    const rows = await rowsStmt.all([...params, sanitizedLimit, offset]);

    const countStmt = db().prepare(`SELECT COUNT(*) AS total FROM users ${whereClause}`);
    const countRow = await countStmt.get(params);
    const total = Number(countRow?.total || 0);

    return {
      data: rows.map(mapRow),
      pagination: {
        total,
        page: sanitizedPage,
        limit: sanitizedLimit,
        pages: Math.max(1, Math.ceil(total / sanitizedLimit)),
      },
    };
  }
}

module.exports = new UserModel();
