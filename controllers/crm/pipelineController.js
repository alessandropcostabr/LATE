// controllers/crm/pipelineController.js

const PipelineModel = require('../../models/pipeline');

async function listPipelines(req, res) {
  try {
    const rows = await PipelineModel.listPipelinesWithStages('opportunity');
    const pipelines = new Map();
    rows.forEach((row) => {
      if (!pipelines.has(row.pipeline_id)) {
        pipelines.set(row.pipeline_id, {
          id: row.pipeline_id,
          object_type: row.object_type,
          name: row.pipeline_name,
          requires_account: row.requires_account,
          requires_contact: row.requires_contact,
          active: row.active,
          created_at: row.pipeline_created_at,
          updated_at: row.pipeline_updated_at,
          stages: [],
        });
      }
      if (row.stage_id) {
        pipelines.get(row.pipeline_id).stages.push({
          id: row.stage_id,
          pipeline_id: row.pipeline_id,
          name: row.stage_name,
          position: row.stage_position,
          probability: row.stage_probability,
          color: row.stage_color,
          sla_minutes: row.stage_sla_minutes,
          created_at: row.stage_created_at,
          updated_at: row.stage_updated_at,
          required_fields: row.required_fields,
          forbid_jump: row.forbid_jump,
          forbid_back: row.forbid_back,
          auto_actions: row.auto_actions,
        });
      }
    });
    return res.json({ success: true, data: Array.from(pipelines.values()) });
  } catch (err) {
    console.error('[crm] listPipelines', err);
    return res.status(500).json({ success: false, error: 'Erro ao listar pipelines' });
  }
}

async function updateStageConfig(req, res) {
  try {
    const id = req.params.id;
    const payload = {
      name: req.body.name,
      position: req.body.position,
      probability: req.body.probability,
      color: req.body.color,
      sla_minutes: req.body.sla_minutes,
    };
    const updated = await PipelineModel.updateStage(id, payload);
    if (!updated) return res.status(404).json({ success: false, error: 'Estágio não encontrado' });
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[crm] updateStageConfig', err);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar estágio' });
  }
}

async function updateStageRule(req, res) {
  try {
    const id = req.params.id;
    const rule = {
      required_fields: Array.isArray(req.body.required_fields) ? req.body.required_fields : [],
      forbid_jump: req.body.forbid_jump === true || String(req.body.forbid_jump).toLowerCase() === 'true',
      forbid_back: req.body.forbid_back === true || String(req.body.forbid_back).toLowerCase() === 'true',
      auto_actions: req.body.auto_actions || [],
    };
    const updated = await PipelineModel.upsertRule(id, rule);
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[crm] updateStageRule', err);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar regra' });
  }
}

module.exports = {
  listPipelines,
  updateStageConfig,
  updateStageRule,
};
