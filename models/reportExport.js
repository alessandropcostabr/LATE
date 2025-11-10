// models/reportExport.js
// Fila de exportações de relatórios (auditoria e registros).

const { randomUUID } = require('crypto');
const db = require('../config/database');

const EXPORT_TYPES = ['event_logs', 'messages'];
const EXPORT_FORMATS = ['csv', 'json'];
const EXPORT_STATUSES = ['pending', 'processing', 'completed', 'failed', 'expired'];

function normalizeType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!EXPORT_TYPES.includes(normalized)) {
    throw new Error('Tipo de exportação inválido.');
  }
  return normalized;
}

function normalizeFormat(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!EXPORT_FORMATS.includes(normalized)) {
    throw new Error('Formato inválido (use csv ou json).');
  }
  return normalized;
}

function stripInternalFilters(raw = {}) {
  if (!raw || typeof raw !== 'object') return {};
  const clone = JSON.parse(JSON.stringify(raw));
  if (clone && typeof clone === 'object') {
    delete clone._viewer;
  }
  return clone;
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    export_type: row.export_type,
    format: row.format,
    status: row.status,
    filters: stripInternalFilters(row.filters || {}),
    created_by: row.created_by,
    file_path: row.file_path || null,
    file_name: row.file_name || null,
    file_size: row.file_size || null,
    error: row.error || null,
    created_at: row.created_at,
    started_at: row.started_at,
    completed_at: row.completed_at,
    expires_at: row.expires_at,
  };
}

async function create({ exportType, format, filters = {}, createdBy }) {
  if (!Number.isInteger(createdBy) || createdBy <= 0) {
    throw new Error('Usuário inválido para exportação.');
  }
  const safeType = normalizeType(exportType);
  const safeFormat = normalizeFormat(format || 'csv');
  const payload = filters && typeof filters === 'object' ? filters : {};
  const id = randomUUID();

  const { rows } = await db.query(
    `INSERT INTO report_exports (id, export_type, format, filters, created_by)
         VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
    [id, safeType, safeFormat, payload, createdBy]
  );
  return mapRow(rows?.[0]);
}

async function listByUser(userId, { limit = 25 } = {}) {
  if (!Number.isInteger(userId) || userId <= 0) return [];
  const safeLimit = Math.max(1, Math.min(Number(limit) || 25, 100));
  const { rows } = await db.query(
    `SELECT *
       FROM report_exports
      WHERE created_by = $1
   ORDER BY created_at DESC
      LIMIT $2`,
    [userId, safeLimit]
  );
  return rows.map(mapRow);
}

async function findById(id) {
  if (!id) return null;
  const { rows } = await db.query('SELECT * FROM report_exports WHERE id = $1 LIMIT 1', [id]);
  return mapRow(rows?.[0]);
}

async function markProcessing(id) {
  await db.query(
    `UPDATE report_exports
        SET status = 'processing',
            started_at = NOW(),
            error = NULL,
            updated_at = NOW()
      WHERE id = $1`,
    [id]
  );
}

async function markCompleted(id, { filePath, fileName, fileSize }) {
  await db.query(
    `UPDATE report_exports
        SET status = 'completed',
            file_path = $2,
            file_name = $3,
            file_size = $4,
            completed_at = NOW(),
            error = NULL,
            updated_at = NOW()
      WHERE id = $1`,
    [id, filePath, fileName, fileSize ?? null]
  );
}

async function markFailed(id, errorMessage) {
  await db.query(
    `UPDATE report_exports
        SET status = 'failed',
            error = $2,
            completed_at = NOW(),
            updated_at = NOW()
      WHERE id = $1`,
    [id, errorMessage ? String(errorMessage).slice(0, 500) : null]
  );
}

async function markExpired(id) {
  await db.query(
    `UPDATE report_exports
        SET status = 'expired',
            completed_at = NOW(),
            updated_at = NOW()
      WHERE id = $1`,
    [id]
  );
}

async function pullPending(limit = 2) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 2, 10));
  const skipLocked = process.env.NODE_ENV === 'test' ? 'FOR UPDATE' : 'FOR UPDATE SKIP LOCKED';
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT *
         FROM report_exports
        WHERE status = 'pending'
          AND (expires_at IS NULL OR expires_at >= NOW())
     ORDER BY created_at ASC
        LIMIT $1
        ${skipLocked}`,
      [safeLimit]
    );
    let mappedRows = rows.map(mapRow);
    if (rows.length) {
      const ids = rows.map((row) => row.id);
      await client.query(
        `UPDATE report_exports
            SET status = 'processing',
                started_at = NOW(),
                updated_at = NOW()
          WHERE id = ANY($1::uuid[])`,
        [ids]
      );
      mappedRows = mappedRows.map((row) => ({
        ...row,
        status: 'processing',
        started_at: row.started_at || new Date(),
      }));
    }
    await client.query('COMMIT');
    return mappedRows;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function requeueStuckProcessing(timeoutMinutes = 10) {
  const minutes = Math.max(1, Number(timeoutMinutes) || 10);
  const { rowCount } = await db.query(
    `UPDATE report_exports
        SET status = 'pending',
            started_at = NULL,
            error = NULL,
            updated_at = NOW()
      WHERE status = 'processing'
        AND started_at IS NOT NULL
        AND started_at <= NOW() - (INTERVAL '1 minute' * $1)`,
    [minutes]
  );
  return rowCount;
}

async function cleanupExpiredFiles() {
  const { rows } = await db.query(
    `SELECT *
       FROM report_exports
      WHERE status = 'completed'
        AND expires_at IS NOT NULL
        AND expires_at <= NOW()`
  );
  return rows.map(mapRow);
}

async function getQueueMetrics() {
  const { rows } = await db.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
      COUNT(*) FILTER (WHERE status = 'processing')::int AS processing,
      COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
      COUNT(*) FILTER (WHERE status = 'processing' AND started_at IS NOT NULL AND started_at <= NOW() - INTERVAL '15 minutes')::int AS stalled
    FROM report_exports
  `);

  const summary = rows[0] || { pending: 0, processing: 0, failed: 0, stalled: 0 };

  const [lastFailed] = (
    await db.query(
      `SELECT id, error, completed_at
         FROM report_exports
        WHERE status = 'failed'
     ORDER BY completed_at DESC NULLS LAST
        LIMIT 1`
    )
  ).rows;

  const [lastCompleted] = (
    await db.query(
      `SELECT id, completed_at
         FROM report_exports
        WHERE status = 'completed'
     ORDER BY completed_at DESC NULLS LAST
        LIMIT 1`
    )
  ).rows;

  return {
    counts: {
      pending: Number(summary.pending) || 0,
      processing: Number(summary.processing) || 0,
      failed: Number(summary.failed) || 0,
    },
    stalled: Number(summary.stalled) || 0,
    last_failed: lastFailed
      ? {
          id: lastFailed.id,
          error: lastFailed.error || null,
          at: lastFailed.completed_at,
        }
      : null,
    last_completed_at: lastCompleted?.completed_at || null,
  };
}

module.exports = {
  create,
  listByUser,
  findById,
  markProcessing,
  markCompleted,
  markFailed,
  markExpired,
  pullPending,
  requeueStuckProcessing,
  cleanupExpiredFiles,
  getQueueMetrics,
  EXPORT_TYPES,
  EXPORT_FORMATS,
  EXPORT_STATUSES,
};
