// models/sector.js
// Regras de negócio de "Setores" (PG-only).
// Comentários em pt-BR; identificadores em inglês.

const db = require('../config/database');

// Helper placeholder PG
const ph = (i) => `$${i}`;

// Normalizações
const toStr = (v) => (v === undefined || v === null ? '' : String(v));
const trim = (v) => toStr(v).trim();
const emptyToNull = (v) => (trim(v) === '' ? null : trim(v));
const normalizeEmail = (email) => trim(email).toLowerCase();

const SELECT_COLUMNS = `
  id, name, email, is_active, created_at, updated_at
`;

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    is_active: row.is_active === true || row.is_active === 't' || row.is_active === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function getById(id) {
  const { rows } = await db.query(`SELECT ${SELECT_COLUMNS} FROM sectors WHERE id = ${ph(1)} LIMIT 1`, [id]);
  return mapRow(rows?.[0]);
}

async function list({ q = '', page = 1, limit = 10 } = {}) {
  const l = Math.max(1, Math.min(Number(limit) || 10, 200));
  const p = Math.max(1, Number(page) || 1);
  const offset = (p - 1) * l;

  const filters = [];
  const params = [];
  let i = 1;

  const query = trim(q);
  if (query) {
    filters.push(`(LOWER(name) LIKE ${ph(i)} OR LOWER(email) LIKE ${ph(i + 1)})`);
    const term = `%${query.toLowerCase()}%`;
    params.push(term, term);
    i += 2;
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const { rows } = await db.query(`
    SELECT ${SELECT_COLUMNS}
      FROM sectors
      ${where}
  ORDER BY name ASC
     LIMIT ${ph(i)} OFFSET ${ph(i + 1)}
  `, [...params, l, offset]);

  const { rows: cRows } = await db.query(`SELECT COUNT(*)::int AS total FROM sectors ${where}`, params);
  const total = Number(cRows?.[0]?.total || 0);

  return {
    data: rows.map(mapRow),
    pagination: { total, page: p, limit: l, pages: Math.max(1, Math.ceil(total / l)) },
  };
}

async function create({ name, email }) {
  const n = trim(name);
  if (!n) {
    const e = new Error('Nome do setor é obrigatório');
    e.code = 'VALIDATION';
    throw e;
  }
  if (n.length > 120) {
    const e = new Error('Nome do setor não pode exceder 120 caracteres');
    e.code = 'VALIDATION';
    throw e;
  }
  const em = emptyToNull(email) ? normalizeEmail(email) : null;

  try {
    const { rows } = await db.query(`
      INSERT INTO sectors (name, email, is_active)
      VALUES (${ph(1)}, ${ph(2)}, TRUE)
      RETURNING ${SELECT_COLUMNS}
    `, [n, em]);
    return mapRow(rows?.[0]);
  } catch (err) {
    if (err.code === '23505') {
      // unique violation (LOWER(name) unique ou LOWER(email) unique)
      const e = new Error(em && /email/i.test(err.detail || '') ? 'E-mail de setor já cadastrado' : 'Nome de setor já cadastrado');
      e.code = 'UNIQUE';
      throw e;
    }
    throw err;
  }
}

async function update(id, { name, email }) {
  const n = trim(name);
  if (!n) {
    const e = new Error('Nome do setor é obrigatório');
    e.code = 'VALIDATION';
    throw e;
  }
  if (n.length > 120) {
    const e = new Error('Nome do setor não pode exceder 120 caracteres');
    e.code = 'VALIDATION';
    throw e;
  }
  const em = emptyToNull(email) ? normalizeEmail(email) : null;

  try {
    const { rowCount } = await db.query(`
      UPDATE sectors
         SET name = ${ph(1)},
             email = ${ph(2)},
             updated_at = CURRENT_TIMESTAMP
       WHERE id = ${ph(3)}
    `, [n, em, id]);
    return rowCount > 0;
  } catch (err) {
    if (err.code === '23505') {
      const e = new Error(em && /email/i.test(err.detail || '') ? 'E-mail de setor já cadastrado' : 'Nome de setor já cadastrado');
      e.code = 'UNIQUE';
      throw e;
    }
    throw err;
  }
}

async function canDelete(id) {
  const { rows } = await db.query(`SELECT EXISTS(SELECT 1 FROM user_sectors WHERE sector_id=${ph(1)}) AS has_users`, [id]);
  return !Boolean(rows?.[0]?.has_users);
}

async function remove(id) {
  // Regra: não pode excluir setor que ainda tem usuários
  const ok = await canDelete(id);
  if (!ok) {
    const e = new Error('Não é possível excluir setor com usuários associados');
    e.code = 'SECTOR_HAS_USERS';
    throw e;
  }
  const { rowCount } = await db.query(`DELETE FROM sectors WHERE id = ${ph(1)}`, [id]);
  return rowCount > 0;
}

async function setActive(id, isActive) {
  const { rowCount } = await db.query(`
    UPDATE sectors
       SET is_active = ${ph(1)}, updated_at = CURRENT_TIMESTAMP
     WHERE id = ${ph(2)}
  `, [!!isActive, id]);
  return rowCount > 0;
}

module.exports = {
  getById, list, create, update, remove, setActive,
};

