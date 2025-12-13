// models/recadoSync.js
// Sincroniza recados (messages) em activities para CRM.

const db = require('../config/database');

async function listUnmapped(limit = 200) {
  const sql = `
    SELECT m.id, m.sender_name, m.sender_phone, m.sender_email, m.message, m.created_at
      FROM messages m
     WHERE NOT EXISTS (
       SELECT 1 FROM activities a WHERE a.location = concat('recado:', m.id)
     )
     ORDER BY m.created_at DESC
     LIMIT $1
  `;
  const { rows } = await db.query(sql, [limit]);
  return rows || [];
}

module.exports = {
  listUnmapped,
};
