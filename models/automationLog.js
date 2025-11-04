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

function truncateToMinute(date) {
  if (!date) return null;
  const copy = new Date(date);
  copy.setSeconds(0, 0);
  return copy;
}

exports.create = async ({ automationId, messageId, status, error, payload, createdAt = null }) => {
  const createdAtValue = createdAt ? new Date(createdAt) : null;
  const minuteBucket = truncateToMinute(createdAtValue || new Date());
  try {
    const { rows } = await db.query(
      `INSERT INTO automation_logs (automation_id, message_id, status, error, payload, created_at, created_at_minute)
           VALUES ($1, $2, $3, $4, $5, COALESCE($6, NOW()), COALESCE($7, date_trunc('minute', COALESCE($6, NOW()))))
        RETURNING id, automation_id, message_id, status, error, payload, created_at`,
      [automationId, messageId || null, status, error || null, payload || null, createdAtValue, minuteBucket]
    );
    return rows[0] || null;
  } catch (err) {
    if (err?.code === '23505') {
      return null;
    }
    throw err;
  }
};
