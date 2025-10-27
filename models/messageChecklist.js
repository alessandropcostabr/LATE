// models/messageChecklist.js
// Checklists e itens associados aos recados.

const db = require('../config/database');

const TITLE_MIN = 1;
const TITLE_MAX = 200;

function isMissingRelation(err) {
  return err && err.code === '42P01';
}

function sanitizeTitle(title) {
  if (typeof title !== 'string') return '';
  return title.trim();
}

async function recalcProgress(checklistId, client = db) {
  const { rows } = await client.query(
    `SELECT
        COUNT(*)::int AS total,
        COALESCE(SUM(CASE WHEN done THEN 1 ELSE 0 END), 0)::int AS done
       FROM message_checklist_items
      WHERE checklist_id = $1`,
    [checklistId]
  );

  const total = rows[0]?.total || 0;
  const done = rows[0]?.done || 0;
  const progress = total === 0 ? 0 : Math.round((done / total) * 100);

  await client.query(
    `UPDATE message_checklists
        SET progress_cached = $2,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = $1`,
    [checklistId, progress]
  );

  return progress;
}

exports.listByMessage = async (messageId) => {
  let checklistRows;
  try {
    const result = await db.query(
      `SELECT id, message_id, title, progress_cached, created_at, updated_at
         FROM message_checklists
        WHERE message_id = $1
     ORDER BY created_at ASC`,
      [messageId]
    );
    checklistRows = result.rows;
  } catch (err) {
    if (isMissingRelation(err)) {
      return [];
    }
    throw err;
  }

  if (!checklistRows.length) return [];

  const checklistIds = checklistRows.map((row) => row.id);
  let itemRows = [];
  try {
    const resultItems = await db.query(
      `SELECT id, checklist_id, title, done, position, created_at, updated_at
         FROM message_checklist_items
        WHERE checklist_id = ANY($1)
     ORDER BY position ASC, created_at ASC`,
      [checklistIds]
    );
    itemRows = resultItems.rows;
  } catch (err) {
    if (!isMissingRelation(err)) {
      throw err;
    }
  }

  const itemsByChecklist = itemRows.reduce((acc, item) => {
    const list = acc.get(item.checklist_id) || [];
    list.push(item);
    acc.set(item.checklist_id, list);
    return acc;
  }, new Map());

  return checklistRows.map((row) => ({
    ...row,
    items: itemsByChecklist.get(row.id) || [],
  }));
};

exports.findById = async (id) => {
  const { rows } = await db.query(
    `SELECT id, message_id, title, progress_cached, created_at, updated_at
       FROM message_checklists
      WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
};

exports.create = async ({ messageId, title }) => {
  const sanitized = sanitizeTitle(title);
  if (sanitized.length < TITLE_MIN || sanitized.length > TITLE_MAX) {
    const err = new Error('Título inválido.');
    err.code = 'INVALID_TITLE';
    throw err;
  }

  const { rows } = await db.query(
    `INSERT INTO message_checklists (message_id, title)
         VALUES ($1, $2)
      RETURNING id, message_id, title, progress_cached, created_at, updated_at`,
    [messageId, sanitized]
  );
  return { ...rows[0], items: [] };
};

exports.update = async (id, { title }) => {
  const sanitized = sanitizeTitle(title);
  if (sanitized.length < TITLE_MIN || sanitized.length > TITLE_MAX) {
    const err = new Error('Título inválido.');
    err.code = 'INVALID_TITLE';
    throw err;
  }

  const { rows } = await db.query(
    `UPDATE message_checklists
        SET title = $2,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
  RETURNING id, message_id, title, progress_cached, created_at, updated_at`,
    [id, sanitized]
  );
  return rows[0] || null;
};

exports.remove = async (id) => {
  const { rowCount } = await db.query(
    `DELETE FROM message_checklists
      WHERE id = $1`,
    [id]
  );
  return rowCount > 0;
};

exports.createItem = async ({ checklistId, title }) => {
  const sanitized = sanitizeTitle(title);
  if (sanitized.length < TITLE_MIN || sanitized.length > TITLE_MAX) {
    const err = new Error('Título inválido.');
    err.code = 'INVALID_TITLE';
    throw err;
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: positionRows } = await client.query(
      `SELECT COALESCE(MAX(position) + 1, 0) AS next_position
         FROM message_checklist_items
        WHERE checklist_id = $1`,
      [checklistId]
    );
    const position = Number(positionRows[0]?.next_position || 0);

    const { rows } = await client.query(
      `INSERT INTO message_checklist_items (checklist_id, title, position)
           VALUES ($1, $2, $3)
        RETURNING id, checklist_id, title, done, position, created_at, updated_at`,
      [checklistId, sanitized, position]
    );

    const item = rows[0];
    await recalcProgress(checklistId, client);
    await client.query('COMMIT');
    return item;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.updateItem = async (id, { title, done, position }) => {
  const fields = [];
  const values = [];
  let idx = 1;

  if (title !== undefined) {
    const sanitized = sanitizeTitle(title);
    if (sanitized.length < TITLE_MIN || sanitized.length > TITLE_MAX) {
      const err = new Error('Título inválido.');
      err.code = 'INVALID_TITLE';
      throw err;
    }
    fields.push(`title = $${idx++}`);
    values.push(sanitized);
  }

  if (done !== undefined) {
    fields.push(`done = $${idx++}`);
    values.push(Boolean(done));
  }

  if (position !== undefined && Number.isFinite(position)) {
    fields.push(`position = $${idx++}`);
    values.push(Number(position));
  }

  if (!fields.length) {
    const { rows } = await db.query(
      `SELECT id, checklist_id, title, done, position, created_at, updated_at
         FROM message_checklist_items
        WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE message_checklist_items
          SET ${fields.join(', ')},
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $${idx}
    RETURNING id, checklist_id, title, done, position, created_at, updated_at`,
      [...values, id]
    );

    const item = rows[0] || null;
    if (item) {
      await recalcProgress(item.checklist_id, client);
    }
    await client.query('COMMIT');
    return item;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.removeItem = async (id) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `DELETE FROM message_checklist_items
        WHERE id = $1
    RETURNING checklist_id`,
      [id]
    );

    const checklistId = rows[0]?.checklist_id;
    if (checklistId) {
      await recalcProgress(checklistId, client);
    }
    await client.query('COMMIT');
    return Boolean(checklistId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.recalculateProgress = recalcProgress;
