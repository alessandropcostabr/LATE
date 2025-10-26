// models/messageWatcher.js
// Controle de usuários acompanhando (watchers) os recados.

const db = require('../config/database');

exports.listForMessage = async (messageId) => {
  let rows;
  try {
    ({ rows } = await db.query(
      `SELECT mw.message_id,
              mw.user_id,
              mw.added_at,
              u.name AS user_name,
              u.email AS user_email
         FROM message_watchers mw
    INNER JOIN users u ON u.id = mw.user_id
        WHERE mw.message_id = $1
     ORDER BY u.name ASC`,
      [messageId]
    ));
  } catch (err) {
    if (err?.code === '42P01') {
      return [];
    }
    throw err;
  }

  return rows.map((row) => ({
    message_id: row.message_id,
    user_id: row.user_id,
    added_at: row.added_at,
    user_name: row.user_name,
    user_email: row.user_email,
  }));
};

exports.addWatcher = async ({ messageId, userId }) => {
  if (!Number.isInteger(userId)) {
    const err = new Error('Usuário inválido.');
    err.code = 'INVALID_USER';
    throw err;
  }

  await db.query(
    `INSERT INTO message_watchers (message_id, user_id)
         VALUES ($1, $2)
     ON CONFLICT (message_id, user_id) DO NOTHING`,
    [messageId, userId]
  );

  const { rows } = await db.query(
    `SELECT mw.message_id,
            mw.user_id,
            mw.added_at,
            u.name AS user_name,
            u.email AS user_email
       FROM message_watchers mw
  INNER JOIN users u ON u.id = mw.user_id
      WHERE mw.message_id = $1
        AND mw.user_id = $2`,
    [messageId, userId]
  );
  return rows[0] || null;
};

exports.removeWatcher = async ({ messageId, userId }) => {
  const { rowCount } = await db.query(
    `DELETE FROM message_watchers
      WHERE message_id = $1
        AND user_id = $2`,
    [messageId, userId]
  );
  return rowCount > 0;
};
