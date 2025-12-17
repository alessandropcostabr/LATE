// models/telephonyEventModel.js
// Persistência de eventos de telefonia (Asterisk -> LATE)

const db = require('../config/database');

async function insertEvent(event) {
  const sql = `
    INSERT INTO telephony_events
      (uniqueid, event, state, caller, callee, trunk, start_ts, payload)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (uniqueid, event) DO NOTHING
    RETURNING id;
  `;

  const params = [
    event.uniqueid,
    event.event,
    event.state || null,
    event.caller || null,
    event.callee || null,
    event.trunk || null,
    event.start_ts,
    event.payload || null,
  ];

  const { rows } = await db.query(sql, params);
  const persisted = rows.length > 0;
  return { id: rows[0]?.id || null, persisted };
}

module.exports = {
  insertEvent,
};
