// models/automation.js
// Automations configuráveis para eventos de recados.

const db = require('../config/database');

const ALLOWED_EVENTS = new Set(['due_in_minutes', 'aging_hours', 'status_changed']);

function validateEvent(event) {
  const normalized = String(event || '').trim().toLowerCase();
  if (!ALLOWED_EVENTS.has(normalized)) {
    const err = new Error('Evento de automação inválido.');
    err.code = 'INVALID_EVENT';
    throw err;
  }
  return normalized;
}

function sanitizeJson(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_err) {
    const err = new Error('JSON inválido.');
    err.code = 'INVALID_JSON';
    throw err;
  }
}

exports.list = async () => {
  const { rows } = await db.query(
    `SELECT id, event, condition_json, action_json, is_active, description, created_at, updated_at
       FROM automations
   ORDER BY created_at DESC`
  );
  return rows;
};

exports.findById = async (id) => {
  const { rows } = await db.query(
    `SELECT id, event, condition_json, action_json, is_active, description, created_at, updated_at
       FROM automations
      WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
};

exports.create = async ({ event, conditionJson, actionJson, description }) => {
  const normalizedEvent = validateEvent(event);
  const condition = sanitizeJson(conditionJson);
  const action = sanitizeJson(actionJson);
  if (!action) {
    const err = new Error('Ação obrigatória.');
    err.code = 'INVALID_ACTION';
    throw err;
  }

  const { rows } = await db.query(
    `INSERT INTO automations (event, condition_json, action_json, description)
         VALUES ($1, $2, $3, $4)
      RETURNING id, event, condition_json, action_json, is_active, description, created_at, updated_at`,
    [normalizedEvent, condition, action, description || null]
  );
  return rows[0];
};

exports.update = async (id, { event, conditionJson, actionJson, description, isActive }) => {
  const fields = [];
  const values = [];
  let idx = 1;

  if (event !== undefined) {
    fields.push(`event = $${idx++}`);
    values.push(validateEvent(event));
  }

  if (conditionJson !== undefined) {
    fields.push(`condition_json = $${idx++}`);
    values.push(sanitizeJson(conditionJson));
  }

  if (actionJson !== undefined) {
    const action = sanitizeJson(actionJson);
    if (!action) {
      const err = new Error('Ação obrigatória.');
      err.code = 'INVALID_ACTION';
      throw err;
    }
    fields.push(`action_json = $${idx++}`);
    values.push(action);
  }

  if (description !== undefined) {
    fields.push(`description = $${idx++}`);
    values.push(description ? String(description).trim() : null);
  }

  if (isActive !== undefined) {
    fields.push(`is_active = $${idx++}`);
    values.push(Boolean(isActive));
  }

  if (!fields.length) {
    return exports.findById(id);
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);

  const { rows } = await db.query(
    `UPDATE automations
        SET ${fields.join(', ')}
      WHERE id = $${idx}
  RETURNING id, event, condition_json, action_json, is_active, description, created_at, updated_at`,
    [...values, id]
  );

  return rows[0] || null;
};

exports.remove = async (id) => {
  const { rowCount } = await db.query(
    `DELETE FROM automations
      WHERE id = $1`,
    [id]
  );
  return rowCount > 0;
};

exports.setActive = async (id, active) => {
  const { rows } = await db.query(
    `UPDATE automations
        SET is_active = $2,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
  RETURNING id, event, condition_json, action_json, is_active, description, created_at, updated_at`,
    [id, Boolean(active)]
  );
  return rows[0] || null;
};

exports.ALLOWED_EVENTS = ALLOWED_EVENTS;
