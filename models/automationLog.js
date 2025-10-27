// models/automationLog.js
// Logs de execução das automations.

const db = require('../config/database');

exports.listByAutomation = async (automationId, { limit = 100, offset = 0 } = {}) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 500);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const { rows } = await db.query(
    `SELECT id, automation_id, message_id, status, error, payload, created_at
       FROM automation_logs
      WHERE automation_id = $1
   ORDER BY created_at DESC
      LIMIT $2 OFFSET $3`,
    [automationId, safeLimit, safeOffset]
  );

  return rows;
};

exports.create = async ({ automationId, messageId, status, error, payload }) => {
  const { rows } = await db.query(
    `INSERT INTO automation_logs (automation_id, message_id, status, error, payload)
         VALUES ($1, $2, $3, $4, $5)
      RETURNING id, automation_id, message_id, status, error, payload, created_at`,
    [automationId, messageId || null, status, error || null, payload || null]
  );
  return rows[0];
};
