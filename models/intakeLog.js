// models/intakeLog.js
// Auditoria das requisições de intake.

const db = require('../config/database');

exports.create = async ({ messageId = null, tokenHash = null, payload = null, ip = null, userAgent = null, status, error = null }) => {
  await db.query(
    `INSERT INTO intake_logs (message_id, token_hash, payload, ip, user_agent, status, error)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [messageId, tokenHash, payload || null, ip, userAgent, status, error]
  );
};
