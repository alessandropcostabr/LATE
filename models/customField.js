// models/customField.js
// CRUD de custom_fields (PG-only).

const db = require('../config/database');

async function list(entity) {
  const where = entity ? 'WHERE entity = $1' : '';
  const params = entity ? [entity] : [];
  const sql = `
    SELECT * FROM custom_fields
    ${where}
    ORDER BY entity, position, name
  `;
  const { rows } = await db.query(sql, params);
  return rows || [];
}

async function create(field) {
  const sql = `
    INSERT INTO custom_fields (entity, name, type, options, required, position)
    VALUES ($1,$2,$3,$4,$5,$6)
    RETURNING *
  `;
  const params = [
    field.entity,
    field.name,
    field.type,
    field.options || [],
    field.required === true,
    Number(field.position || 0),
  ];
  const { rows } = await db.query(sql, params);
  return rows?.[0] || null;
}

async function update(id, updates) {
  const sql = `
    UPDATE custom_fields
       SET name = COALESCE($2, name),
           type = COALESCE($3, type),
           options = COALESCE($4, options),
           required = COALESCE($5, required),
           position = COALESCE($6, position),
           updated_at = NOW()
     WHERE id = $1
     RETURNING *
  `;
  const params = [
    id,
    updates.name || null,
    updates.type || null,
    updates.options || null,
    typeof updates.required === 'boolean' ? updates.required : null,
    updates.position !== undefined ? Number(updates.position) : null,
  ];
  const { rows } = await db.query(sql, params);
  return rows?.[0] || null;
}

async function remove(id) {
  const { rowCount } = await db.query('DELETE FROM custom_fields WHERE id = $1', [id]);
  return rowCount > 0;
}


async function listRequired(entity) {
  const sql = 'SELECT * FROM custom_fields WHERE entity = $1 AND required = TRUE ORDER BY position, name';
  const { rows } = await db.query(sql, [entity]);
  return rows || [];
}

module.exports = {
  list,
  create,
  update,
  remove,
  listRequired,
};
