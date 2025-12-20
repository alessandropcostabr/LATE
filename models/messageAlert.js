// models/messageAlert.js
// Registro de envios de alertas recorrentes para recados.

const db = require('../config/database');

function ph(i) { return `$${i}`; }

class MessageAlertModel {
  async log({ message_id, alert_type }) {
    const sql = `
      INSERT INTO message_alerts (message_id, alert_type)
      VALUES (${ph(1)}, ${ph(2)})
      RETURNING id, message_id, alert_type, sent_at
    `;
    const { rows } = await db.query(sql, [message_id, alert_type]);
    return rows?.[0] || null;
  }

  async getLastAlertAt(message_id, alert_type) {
    const sql = `
      SELECT MAX(sent_at) AS last_sent
        FROM message_alerts
       WHERE message_id = ${ph(1)}
         AND alert_type = ${ph(2)}
    `;
    const { rows } = await db.query(sql, [message_id, alert_type]);
    return rows?.[0]?.last_sent || null;
  }

  async getLastAlertsByType(messageIds = [], alert_type) {
    const ids = Array.from(new Set(messageIds)).filter(Boolean);
    if (ids.length === 0) return {};
    const placeholders = ids.map((_, index) => ph(index + 1)).join(', ');
    const sql = `
      SELECT message_id, MAX(sent_at) AS last_sent
        FROM message_alerts
       WHERE message_id IN (${placeholders})
         AND alert_type = ${ph(ids.length + 1)}
       GROUP BY message_id
    `;
    const { rows } = await db.query(sql, [...ids, alert_type]);
    return rows.reduce((acc, row) => {
      acc[row.message_id] = row.last_sent;
      return acc;
    }, {});
  }
}

module.exports = new MessageAlertModel();
