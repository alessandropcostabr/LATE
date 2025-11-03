// utils/devInfo.js
// Reúne informações de diagnóstico para CLI e endpoint de debug.

const path = require('path');
const fs = require('fs');
const db = require('../config/database');

const PENDING_STATUS = 'pending';
const DEFAULT_JSON_FILENAME = 'diagnostics.json';

async function fetchCurrentDatabase() {
  const { rows } = await db.query('SELECT current_database() AS name');
  return rows?.[0]?.name || null;
}

async function fetchPgcryptoStatus() {
  try {
    const { rows } = await db.query(
      "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') AS enabled"
    );
    return rows?.[0]?.enabled === true;
  } catch (err) {
    const message = err && typeof err.message === 'string' ? err.message : '';
    if (err?.code === '42P01' || message.includes('pg_extension')) {
      return null;
    }
    throw err;
  }
}

async function fetchMessageIndexes() {
  try {
    const { rows } = await db.query(
      `SELECT indexname
         FROM pg_indexes
        WHERE schemaname = current_schema()
          AND tablename = 'messages'
     ORDER BY indexname ASC`
    );
    return Array.isArray(rows) ? rows.map((row) => row.indexname).filter(Boolean) : [];
  } catch (err) {
    const message = err && typeof err.message === 'string' ? err.message : '';
    if (err?.code === '42P01' || message.includes('pg_indexes')) {
      return [];
    }
    throw err;
  }
}

async function fetchEmailQueuePending() {
  try {
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS count
         FROM email_queue
        WHERE status = $1`,
      [PENDING_STATUS]
    );
    return Number(rows?.[0]?.count || 0);
  } catch (err) {
    // 42P01 = undefined_table (ambientes sem a fila ainda migrada)
    if (err && err.code === '42P01') {
      return null;
    }
    throw err;
  }
}

async function collectDevInfo() {
  const [pgDatabase, pgcrypto, messageIndexes, emailQueuePending] = await Promise.all([
    fetchCurrentDatabase(),
    fetchPgcryptoStatus(),
    fetchMessageIndexes(),
    fetchEmailQueuePending(),
  ]);

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    pgDatabase,
    pgcrypto,
    messageIndexes,
    emailQueuePending,
    generatedAt: new Date().toISOString(),
  };
}

async function writeDiagnosticsJson(data, outputPath) {
  const resolvedPath = path.resolve(process.cwd(), outputPath || DEFAULT_JSON_FILENAME);
  fs.writeFileSync(resolvedPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return resolvedPath;
}

module.exports = {
  collectDevInfo,
  writeDiagnosticsJson,
  DEFAULT_JSON_FILENAME,
};
