// controllers/callLogController.js
// Lista consolidada de call_logs com filtros simples

const db = require('../config/database');
const { normalizePhone } = require('../utils/phone');

const MAX_LIMIT = 100;
const EXCLUDE_INTERNAL = true;

function parsePagination(query) {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(query.limit || 20)));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function parseArrayParam(raw) {
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query || {});
  const statuses = parseArrayParam(req.query.status);
  const caller = req.query.caller ? normalizePhone(req.query.caller) : '';
  const dateFrom = req.query.date_from ? new Date(req.query.date_from) : null;
  const dateTo = req.query.date_to ? new Date(req.query.date_to) : null;

  const where = [];
  const params = [];

  if (EXCLUDE_INTERNAL) {
    where.push('(caller_normalized IS NULL OR callee IS NULL OR caller_normalized <> callee)');
    where.push("(caller_normalized IS NULL OR caller_normalized <> '556000')");
  }

  if (statuses.length) {
    params.push(statuses);
    where.push(`status = ANY($${params.length})`);
  }

  if (caller) {
    params.push(`%${caller}%`);
    where.push(`caller_normalized ILIKE $${params.length}`);
  }

  if (dateFrom) {
    params.push(dateFrom);
    where.push(`started_at >= $${params.length}`);
  }

  if (dateTo) {
    params.push(dateTo);
    where.push(`started_at <= $${params.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const listSql = `
    SELECT id, uniqueid, status, caller, caller_normalized, callee, trunk,
           started_at, ended_at, duration_seconds, recording, customer_id
    FROM call_logs
    ${whereSql}
    ORDER BY started_at DESC NULLS LAST, id DESC
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2};
  `;

  const countSql = `SELECT count(*) AS total FROM call_logs ${whereSql};`;

  try {
    const countPromise = db.query(countSql, params);
    const listPromise = db.query(listSql, [...params, limit, offset]);
    const [countResult, listResult] = await Promise.all([countPromise, listPromise]);

    const total = Number(countResult.rows[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return res.json({
      success: true,
      data: {
        page,
        limit,
        total,
        totalPages,
        items: listResult.rows,
      },
    });
  } catch (err) {
    console.error('[call-logs] erro ao listar:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Erro ao listar call logs' });
  }
}

module.exports = { list };
