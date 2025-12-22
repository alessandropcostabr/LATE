#!/usr/bin/env node

// scripts/bench-crm-pipelines-baseline.js
// Simula o fluxo legado (N+1) para pipelines + stages.

const db = require('../config/database');
const Pipeline = require('../models/pipeline');

const OBJECT_TYPE = process.env.CRM_PIPELINE_OBJECT_TYPE || 'opportunity';

async function main() {
  const startedAt = new Date();
  const startNs = process.hrtime.bigint();

  const pipelines = await Pipeline.listPipelines(OBJECT_TYPE);
  let stageCount = 0;

  for (const pipeline of pipelines) {
    const stages = await Pipeline.getStages(pipeline.id);
    stageCount += stages.length;
  }

  const endNs = process.hrtime.bigint();
  const durationMs = Number(endNs - startNs) / 1e6;

  console.log(JSON.stringify({
    started_at: startedAt.toISOString(),
    duration_ms: Math.round(durationMs),
    object_type: OBJECT_TYPE,
    pipelines: pipelines.length,
    stages: stageCount,
  }, null, 2));
}

main()
  .then(() => db.close())
  .catch((err) => {
    console.error('[bench-crm-pipelines-baseline] falha', err);
    return db.close().catch(() => undefined).finally(() => process.exit(1));
  });
