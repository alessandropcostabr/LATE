// models/messageEvent.js
// Armazena eventos/ocorrências relacionadas aos recados.

const db = require('../config/database');

function ph(i) {
  return `$${i}`;
}

class MessageEventModel {
  async create({ message_id, event_type, payload }) {
    const sql = `
      INSERT INTO message_events (message_id, event_type, payload)
      VALUES (${ph(1)}, ${ph(2)}, ${ph(3)})
      RETURNING id, message_id, event_type, payload, created_at
    `;
    const { rows } = await db.query(sql, [
      message_id,
      String(event_type || '').trim().toLowerCase(),
      payload ? JSON.stringify(payload) : null,
    ]);
    return rows?.[0] || null;
  }

  async listByMessage(messageId, { limit = 50 } = {}) {
    const sql = `
      SELECT id, message_id, event_type, payload, created_at
        FROM message_events
       WHERE message_id = ${ph(1)}
       ORDER BY created_at DESC, id DESC
       LIMIT ${ph(2)}
    `;
    const { rows } = await db.query(sql, [messageId, Math.max(1, Math.min(limit, 200))]);
    return rows || [];
  }
}

module.exports = new MessageEventModel();
