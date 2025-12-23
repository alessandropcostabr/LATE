// models/crmStats.js
// Estatísticas agregadas do CRM (oportunidades e atividades), com uso opcional de materialized views.

const db = require('../config/database');

const MV_PIPELINE = 'mv_crm_pipeline_stage_month';
const MV_ACTIVITIES = 'mv_crm_activities_owner_status';

function isPrivilegedRole(role) {
  const v = String(role || '').toUpperCase();
  return v === 'ADMIN' || v === 'SUPERVISOR';
}

function buildOwnerFilter(user) {
  const role = user?.role || '';
  if (isPrivilegedRole(role)) return { clause: '', params: [] };
  const id = Number(user?.id);
  if (!Number.isInteger(id) || id <= 0) return { clause: '1=0', params: [] };
  return { clause: 'owner_id = $1', params: [id] };
}

async function mvExists(name) {
  const sql = 'SELECT to_regclass($1) IS NOT NULL AS exists';
  const { rows } = await db.query(sql, [name]);
  return rows?.[0]?.exists === true || rows?.[0]?.exists === 't';
}

async function pipelineByStageMonth({ user, months = 6 } = {}) {
  const { clause, params } = buildOwnerFilter(user);
  const span = Math.max(1, Math.min(24, Number(months) || 6));
  const useMv = clause === '' && await mvExists(MV_PIPELINE);

  let sql;
  let sqlParams = params;
  if (useMv) {
    sql = `
      SELECT to_char(month, 'YYYY-MM') AS month, pipeline_id, stage_id, total
        FROM ${MV_PIPELINE}
       WHERE month >= date_trunc('month', NOW()) - (INTERVAL '1 month' * ${span - 1})
       ORDER BY month DESC, pipeline_id, stage_id`;
    sqlParams = [];
  } else {
    sql = `
      WITH months AS (
        SELECT date_trunc('month', NOW()) - (INTERVAL '1 month' * generate_series(0, ${span - 1})) AS m
      )
      SELECT to_char(m, 'YYYY-MM') AS month,
             o.pipeline_id,
             o.stage_id,
             COUNT(o.id)::int AS total
        FROM months
        LEFT JOIN opportunities o
          ON date_trunc('month', o.created_at) = m
         ${clause ? 'AND ' + clause : ''}
         AND o.deleted_at IS NULL
       GROUP BY 1,2,3
       ORDER BY month DESC, pipeline_id, stage_id`;
  }
  const { rows } = await db.query(sql, sqlParams);
  return rows || [];
}

async function activitiesByOwner({ user } = {}) {
  const { clause, params } = buildOwnerFilter(user);
  const useMv = clause === '' && await mvExists(MV_ACTIVITIES);
  let sql = `
    SELECT owner_id, status, COUNT(*)::int AS total
      FROM activities
     WHERE deleted_at IS NULL
     ${clause ? 'AND ' + clause : ''}
     GROUP BY owner_id, status
     ORDER BY owner_id, status`;
  let sqlParams = params;
  if (useMv) {
    sql = `SELECT owner_id, status, total FROM ${MV_ACTIVITIES}`;
    sqlParams = [];
  }
  const { rows } = await db.query(sql, sqlParams);
  return rows || [];
}


async function refreshMaterializedViews() {
  await db.query('SELECT pg_advisory_lock(90210)');
  try {
    // Usa concurrently; se não houver índice unique, cairá em erro — handled fora
    await db.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${MV_PIPELINE}`);
    await db.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${MV_ACTIVITIES}`);
  } finally {
    await db.query('SELECT pg_advisory_unlock(90210)');
  }
}

async function refreshedAt() {
  // Sem tabela de log, usa age do relfile
  const sql = `
    SELECT GREATEST(pg_catalog.pg_relation_size($1::regclass)::bigint, 0) AS size,
           GREATEST(pg_catalog.pg_stat_get_last_analyze_time($1::regclass),
                    pg_catalog.pg_stat_get_last_analyze_time($2::regclass)) AS ts
  `;
  const { rows } = await db.query(sql, [MV_PIPELINE, MV_ACTIVITIES]);
  const ts = rows?.[0]?.ts;
  return ts ? new Date(ts) : null;
}

module.exports = {
  pipelineByStageMonth,
  activitiesByOwner,
  refreshMaterializedViews,
  refreshedAt,
};
