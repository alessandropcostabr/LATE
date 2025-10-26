// models/messageComment.js
// Comentários associados a cada recado (timeline textual).

const db = require('../config/database');

const BODY_MIN = 1;
const BODY_MAX = 5000;

function sanitizeBody(body) {
  if (typeof body !== 'string') return '';
  return body.trim();
}

exports.listByMessage = async (messageId, { limit = 200, offset = 0 } = {}) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 500);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  let rows;
  try {
    ({ rows } = await db.query(
      `SELECT mc.id,
              mc.message_id,
              mc.user_id,
              u.name AS user_name,
              u.email AS user_email,
              mc.body,
              mc.created_at,
              mc.updated_at
         FROM message_comments mc
    LEFT JOIN users u ON u.id = mc.user_id
        WHERE mc.message_id = $1
     ORDER BY mc.created_at ASC
        LIMIT $2 OFFSET $3`,
      [messageId, safeLimit, safeOffset]
    ));
  } catch (err) {
    if (err?.code === '42P01') {
      return [];
    }
    throw err;
  }

  return rows.map((row) => ({
    id: row.id,
    message_id: row.message_id,
    user_id: row.user_id,
    user_name: row.user_name,
    user_email: row.user_email,
    body: row.body,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
};

exports.create = async ({ messageId, userId, body }) => {
  const sanitized = sanitizeBody(body);
  if (sanitized.length < BODY_MIN || sanitized.length > BODY_MAX) {
    const err = new Error('Comentário inválido.');
    err.code = 'INVALID_COMMENT';
    throw err;
  }

  const { rows } = await db.query(
    `INSERT INTO message_comments (message_id, user_id, body)
         VALUES ($1, $2, $3)
      RETURNING id, message_id, user_id, body, created_at, updated_at`,
    [messageId, userId || null, sanitized]
  );

  const comment = rows[0];
  if (!comment) return null;

  if (comment.user_id) {
    const { rows: userRows } = await db.query(
      `SELECT name AS user_name, email AS user_email
         FROM users
        WHERE id = $1`,
      [comment.user_id]
    );
    if (userRows[0]) {
      comment.user_name = userRows[0].user_name;
      comment.user_email = userRows[0].user_email;
    }
  }

  return comment;
};

exports.findById = async (id) => {
  let rows;
  try {
    ({ rows } = await db.query(
      `SELECT mc.id,
              mc.message_id,
              mc.user_id,
              u.name AS user_name,
              u.email AS user_email,
              mc.body,
              mc.created_at,
              mc.updated_at
         FROM message_comments mc
    LEFT JOIN users u ON u.id = mc.user_id
        WHERE mc.id = $1
        LIMIT 1`,
      [id]
    ));
  } catch (err) {
    if (err?.code === '42P01') {
      return null;
    }
    throw err;
  }
  return rows[0] ? {
    id: rows[0].id,
    message_id: rows[0].message_id,
    user_id: rows[0].user_id,
    user_name: rows[0].user_name,
    user_email: rows[0].user_email,
    body: rows[0].body,
    created_at: rows[0].created_at,
    updated_at: rows[0].updated_at,
  } : null;
};

exports.remove = async (id) => {
  const { rowCount } = await db.query(
    `DELETE FROM message_comments
      WHERE id = $1`,
    [id]
  );
  return rowCount > 0;
};
