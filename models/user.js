// models/user.js
// Camada de acesso a dados para PostgreSQL (PG-only).
// Comentários em pt-BR; identificadores em inglês.

const db = require('../config/database'); // Pool do pg

// Helper de placeholder ($1, $2, ...)
function ph(i) { return `$${i}`; }

// Normalizadores
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
    // Garante boolean consistente mesmo se vier 0/1
    is_active: row.is_active === true || row.is_active === 1 || row.is_active === 't',
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
  // Busca por e-mail (case-insensitive)
  async findByEmail(email) {
    const sql = `${BASE_SELECT} WHERE LOWER(email) = LOWER(${ph(1)}) LIMIT 1`;
    const { rows } = await db.query(sql, [normalizeEmail(email)]);
    return mapRow(rows?.[0]);
  }

  async findById(id) {
    const sql = `${BASE_SELECT} WHERE id = ${ph(1)} LIMIT 1`;
    const { rows } = await db.query(sql, [id]);
    return mapRow(rows?.[0]);
  }

  // Cria usuário; retorna os campos principais (id, name, email, role, is_active, created_at, updated_at)
  async create({ name, email, password_hash, role = 'OPERADOR' }) {
    const sql = `
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
        TRUE
      )
      RETURNING id, name, email, role, is_active, created_at, updated_at
    `;
    try {
      const { rows } = await db.query(sql, [
        String(name || '').trim(),
        normalizeEmail(email),
        password_hash,
        normalizeRole(role),
      ]);
      return mapRow(rows?.[0]);
    } catch (err) {
      // 23505 = unique_violation (esperado p/ índice único em LOWER(email))
      if (err && err.code === '23505') {
        const e = new Error('E-mail já cadastrado');
        e.code = 'EMAIL_EXISTS';
        throw e;
      }
      throw err;
    }
  }

  async updatePassword(id, password_hash) {
    const sql = `
      UPDATE users
         SET password_hash = ${ph(1)},
             updated_at = CURRENT_TIMESTAMP
       WHERE id = ${ph(2)}
    `;
    const { rowCount } = await db.query(sql, [password_hash, id]);
    return rowCount > 0;
  }

  // Alias compatível com controller
  async resetPassword(id, password_hash) {
    return this.updatePassword(id, password_hash);
  }

  async update(id, { name, email, role }) {
    const sql = `
      UPDATE users
         SET name = ${ph(1)},
             email = LOWER(${ph(2)}),
             role = ${ph(3)},
             updated_at = CURRENT_TIMESTAMP
       WHERE id = ${ph(4)}
    `;
    try {
      const { rowCount } = await db.query(sql, [
        String(name || '').trim(),
        normalizeEmail(email),
        normalizeRole(role),
        id
      ]);
      return rowCount > 0;
    } catch (err) {
      if (err && err.code === '23505') {
        const e = new Error('E-mail já cadastrado');
        e.code = 'EMAIL_EXISTS';
        throw e;
      }
      throw err;
    }
  }

  async remove(id) {
    const { rowCount } = await db.query(`DELETE FROM users WHERE id = ${ph(1)}`, [id]);
    return rowCount > 0;
  }

  async setActive(id, active) {
    const value = !!active; // garante boolean
    const sql = `
      UPDATE users
         SET is_active = ${ph(1)},
             updated_at = CURRENT_TIMESTAMP
       WHERE id = ${ph(2)}
    `;
    const { rowCount } = await db.query(sql, [value, id]);
    return rowCount > 0;
  }

  async countActiveAdmins({ excludeId } = {}) {
    let sql = `SELECT COUNT(*)::int AS total FROM users WHERE role = 'ADMIN' AND is_active = TRUE`;
    const params = [];
    let idx = 1;

    const parsedExclude = Number(excludeId);
    if (Number.isFinite(parsedExclude)) {
      sql += ` AND id <> ${ph(idx)}`;
      params.push(parsedExclude);
      idx += 1;
    }

    const { rows } = await db.query(sql, params);
    return Number(rows?.[0]?.total || 0);
  }

  async list({ q = '', page = 1, limit = 10 } = {}) {
    const parsedLimit = Number(limit);
    const parsedPage = Number(page);
    const sanitizedLimit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(parsedLimit, 200)) : 10;
    const sanitizedPage = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;
    const offset = (sanitizedPage - 1) * sanitizedLimit;

    const filters = [];
    const params = [];
    let idx = 1;

    if (q) {
      filters.push(`(LOWER(name) LIKE ${ph(idx)} OR LOWER(email) LIKE ${ph(idx + 1)})`);
      const term = `%${String(q).trim().toLowerCase()}%`;
      params.push(term, term);
      idx += 2;
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const rowsSql = `
      ${BASE_SELECT}
      ${whereClause}
      ORDER BY name ASC
      LIMIT ${ph(idx)} OFFSET ${ph(idx + 1)}
    `;
    const { rows } = await db.query(rowsSql, [...params, sanitizedLimit, offset]);

    const countSql = `SELECT COUNT(*)::int AS total FROM users ${whereClause}`;
    const { rows: countRows } = await db.query(countSql, params);
    const total = Number(countRows?.[0]?.total || 0);

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

