// models/diagnostics.js
// Helpers de diagnóstico (PG-only). Mantém SQL fora dos controllers.

const { performance } = require('perf_hooks');
const db = require('../config/database');

async function ping() {
  const startedAt = performance.now();
  await db.query('SELECT 1');
  return { latency_ms: Math.round(performance.now() - startedAt) };
}

async function getPgHealth() {
  const result = {
    ok: false,
    latency_ms: null,
    is_primary: null,
    replication: null,
  };

  try {
    const startedAt = performance.now();
    const pingResult = await db.query('SELECT 1 as ok');
    result.latency_ms = Math.round(performance.now() - startedAt);
    result.ok = pingResult?.rows?.[0]?.ok === 1;
  } catch (err) {
    return { ...result, error: String(err?.message || err) };
  }

  try {
    const rec = await db.query('SELECT pg_is_in_recovery() AS is_recovery');
    const isPrimary = rec?.rows?.[0]?.is_recovery === false;
    result.is_primary = isPrimary;

    if (isPrimary) {
      const replicationPeers = await db.query(`
        SELECT application_name, client_addr, state, sync_state
        FROM pg_stat_replication
      `);
      result.replication = {
        role: 'primary',
        peers: replicationPeers?.rows || [],
      };
    } else {
      const walReceiver = await db.query(`
        SELECT status, receive_start_lsn, received_tli
        FROM pg_stat_wal_receiver
      `);
      const replay = await db.query(`
        SELECT pg_last_wal_receive_lsn() AS receive_lsn,
               pg_last_wal_replay_lsn() AS replay_lsn,
               EXTRACT(EPOCH FROM now() - pg_last_xact_replay_timestamp())::int AS replay_delay_seconds
      `);
      result.replication = {
        role: 'standby',
        wal_receiver: walReceiver?.rows?.[0] || null,
        replay: replay?.rows?.[0] || null,
      };
    }
  } catch (err) {
    result.replication = { role: 'unknown', error: String(err?.message || err) };
  }

  return result;
}

module.exports = {
  ping,
  getPgHealth,
};
