// models/customFieldValue.js
// Upsert de valores de custom fields.

const db = require('../config/database');

async function upsert({ field_id, entity_type, entity_id, value }) {
  const sql = `
    INSERT INTO custom_field_values (field_id, entity_type, entity_id, value)
    VALUES ($1,$2,$3,$4)
    ON CONFLICT (field_id, entity_type, entity_id) DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = NOW()
    RETURNING *
  `;
  const { rows } = await db.query(sql, [field_id, entity_type, entity_id, value]);
  return rows?.[0] || null;
}

async function listValues(entity_type, entity_id) {
  const sql = `
    SELECT cf.name, cf.type, cf.entity, v.*
      FROM custom_field_values v
      JOIN custom_fields cf ON cf.id = v.field_id
     WHERE v.entity_type = $1 AND v.entity_id = $2
     ORDER BY cf.position, cf.name
  `;
  const { rows } = await db.query(sql, [entity_type, entity_id]);
  return rows || [];
}

module.exports = {
  upsert,
  listValues,
};
