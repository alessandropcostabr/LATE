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

async function getStageById(stageId) {
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
  const { rows } = await db.query(sql, [stageId]);
  return rows?.[0] || null;
}

module.exports = {
  listPipelines,
  getPipelineById,
  getStages,
  getStageById,
};
