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
function mapRow(row, { includePassword = false } = {}) {
  if (!row) return null;
  const data = {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    is_active: row.is_active === true || row.is_active === 1 || row.is_active === 't',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  if (includePassword) data.password_hash = row.password_hash;
  return data;
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
    return mapRow(rows?.[0], { includePassword: true });
  }

  async findById(id) {
    const sql = `${BASE_SELECT} WHERE id = ${ph(1)} LIMIT 1`;
    const { rows } = await db.query(sql, [id]);
    return mapRow(rows?.[0]);
  }

  // Cria usuário; retorna os campos principais (id, name, email, role, is_active, created_at, updated_at)
  async create({ name, email, password_hash, role = 'OPERADOR', active = true }) {
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
        ${ph(5)}
      )
      RETURNING id, name, email, role, is_active, created_at, updated_at
    `;
    try {
      const { rows } = await db.query(sql, [
        String(name || '').trim(),
        normalizeEmail(email),
        password_hash,
        normalizeRole(role),
        active === true || active === 'true' || active === 1 || active === '1'
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

  async update(id, { name, email, role, active }) {
    const setClauses = [];
    const params = [];
    let idx = 1;

    if (name !== undefined) {
      setClauses.push(`name = ${ph(idx)}`);
      params.push(String(name || '').trim());
      idx += 1;
    }

    if (email !== undefined) {
      setClauses.push(`email = LOWER(${ph(idx)})`);
      params.push(normalizeEmail(email));
      idx += 1;
    }

    if (role !== undefined) {
      setClauses.push(`role = ${ph(idx)}`);
      params.push(normalizeRole(role));
      idx += 1;
    }

    if (active !== undefined) {
      setClauses.push(`is_active = ${ph(idx)}`);
      params.push(active === true || active === 'true' || active === 1 || active === '1');
      idx += 1;
    }

    if (setClauses.length === 0) {
      return false;
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

    const sql = `
      UPDATE users
         SET ${setClauses.join(', ')}
       WHERE id = ${ph(idx)}
       RETURNING id, name, email, role, is_active, created_at, updated_at
    `;

    params.push(id);

    try {
      const { rows } = await db.query(sql, params);
      return mapRow(rows?.[0]);
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
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const { rows: userRows } = await client.query(`
        SELECT id
          FROM users
         WHERE id = ${ph(1)}
         LIMIT 1
      `, [id]);

      if (!userRows.length) {
        await client.query('ROLLBACK');
        return false;
      }

      const { rows: sectorRows } = await client.query(`
        SELECT sector_id
          FROM user_sectors
         WHERE user_id = ${ph(1)}
      `, [id]);

      const sectorIds = sectorRows.map((row) => row.sector_id);

      if (sectorIds.length > 0) {
        const { rows: counts } = await client.query(`
          SELECT sector_id, COUNT(*)::int AS cnt
            FROM user_sectors
           WHERE sector_id = ANY(${ph(1)})
           GROUP BY sector_id
        `, [sectorIds]);

        const countMap = Object.fromEntries(counts.map((row) => [row.sector_id, row.cnt]));
        const wouldEmptySector = sectorIds.some((sectorId) => (countMap[sectorId] || 0) <= 1);

        if (wouldEmptySector) {
          const err = new Error('Não é possível remover: algum setor ficaria sem usuários');
          err.code = 'SECTOR_MIN_ONE';
          throw err;
        }

        await client.query(`
          DELETE FROM user_sectors
           WHERE user_id = ${ph(1)}
        `, [id]);
      }

      const { rowCount } = await client.query(`
        DELETE FROM users WHERE id = ${ph(1)}
      `, [id]);

      await client.query('COMMIT');
      return rowCount > 0;
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw err;
    } finally {
      client.release();
    }
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
      data: rows.map((row) => mapRow(row)),
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

