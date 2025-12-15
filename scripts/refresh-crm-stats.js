#!/usr/bin/env node
// Atualiza materialized views do CRM.
// Uso: node scripts/refresh-crm-stats.js

require('dotenv').config({ path: process.env.DOTENV_FILE || '.env' });
const db = require('../config/database');

async function main() {
  console.log('[crm-stats] iniciando refresh');
  await db.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_crm_pipeline_stage_month');
  await db.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_crm_activities_owner_status');
  console.log('[crm-stats] refresh concluído');
  await db.end();
}

main().catch((err) => {
  console.error('[crm-stats] erro', err);
  process.exit(1);
});
