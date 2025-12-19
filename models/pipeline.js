// models/pipeline.js
// Acesso aos pipelines e estágios do CRM.

const db = require('../config/database');

async function listPipelines(objectType = 'opportunity') {
  const sql = `
    SELECT id, object_type, name, requires_account, requires_contact, active,
           created_at, updated_at
      FROM pipelines
     WHERE object_type = $1
     ORDER BY name
  `;
  const { rows } = await db.query(sql, [objectType]);
  return rows || [];
}

async function getPipelineById(id) {
  const sql = 'SELECT * FROM pipelines WHERE id = $1 LIMIT 1';
  const { rows } = await db.query(sql, [id]);
  return rows?.[0] || null;
}

async function getStages(pipelineId) {
  const sql = `
    SELECT ps.*,
           pr.required_fields,
           pr.forbid_jump,
           pr.forbid_back,
           pr.auto_actions
      FROM pipeline_stages ps
      LEFT JOIN pipeline_rules pr ON pr.pipeline_stage_id = ps.id
     WHERE ps.pipeline_id = $1
     ORDER BY ps.position
  `;
  const { rows } = await db.query(sql, [pipelineId]);
  return rows || [];
}

async function getStageById(stageId, client = null) {
  const sql = `
    SELECT ps.*,
           pr.required_fields,
           pr.forbid_jump,
           pr.forbid_back,
           pr.auto_actions,
           p.name AS pipeline_name,
           p.object_type,
           p.requires_account,
           p.requires_contact
      FROM pipeline_stages ps
      JOIN pipelines p ON p.id = ps.pipeline_id
      LEFT JOIN pipeline_rules pr ON pr.pipeline_stage_id = ps.id
     WHERE ps.id = $1
     LIMIT 1
  `;
  const runner = client || db;
  const { rows } = await runner.query(sql, [stageId]);
  return rows?.[0] || null;
}

module.exports = {
  listPipelines,
  getPipelineById,
  getStages,
  getStageById,
};


async function updateStage(id, updates = {}) {
  const sql = `
    UPDATE pipeline_stages
       SET name = COALESCE($2, name),
           position = COALESCE($3, position),
           probability = COALESCE($4, probability),
           color = COALESCE($5, color),
           sla_minutes = COALESCE($6, sla_minutes),
           updated_at = NOW()
     WHERE id = $1
     RETURNING *
  `;
  const params = [
    id,
    updates.name || null,
    updates.position !== undefined ? Number(updates.position) : null,
    updates.probability !== undefined ? Number(updates.probability) : null,
    updates.color || null,
    updates.sla_minutes !== undefined ? Number(updates.sla_minutes) : null,
  ];
  const { rows } = await db.query(sql, params);
  return rows?.[0] || null;
}

async function upsertRule(stageId, rule = {}) {
  const sql = `
    INSERT INTO pipeline_rules (pipeline_stage_id, required_fields, forbid_jump, forbid_back, auto_actions)
    VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (pipeline_stage_id) DO UPDATE SET
      required_fields = EXCLUDED.required_fields,
      forbid_jump = EXCLUDED.forbid_jump,
      forbid_back = EXCLUDED.forbid_back,
      auto_actions = EXCLUDED.auto_actions,
      updated_at = NOW()
    RETURNING *
  `;
  const params = [
    stageId,
    Array.isArray(rule.required_fields) ? rule.required_fields : [],
    rule.forbid_jump === true,
    rule.forbid_back === true,
    rule.auto_actions || [],
  ];
  const { rows } = await db.query(sql, params);
  return rows?.[0] || null;
}

module.exports.updateStage = updateStage;
module.exports.upsertRule = upsertRule;
