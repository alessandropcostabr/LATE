// controllers/crmConfigViewController.js
// Tela de configuração do CRM (pipelines/estágios e custom fields)

const PipelineModel = require('../models/pipeline');
const CustomField = require('../models/customField');

async function configPage(req, res) {
  try {
    const pipelines = await PipelineModel.listPipelines('opportunity');
    const stagesByPipeline = {};
    for (const p of pipelines) {
      stagesByPipeline[p.id] = await PipelineModel.getStages(p.id);
    }
    const customFields = await CustomField.list();
    return res.render('crm-config', {
      title: 'CRM · Configuração',
      user: req.session.user || null,
      pipelines,
      stagesByPipeline,
      customFields,
      csrfToken: typeof req.csrfToken === 'function' ? req.csrfToken() : null,
    });
  } catch (err) {
    console.error('[web][crm-config]', err);
    return res.status(500).render('500', { title: 'Erro', user: req.session.user || null });
  }
}

module.exports = {
  configPage,
};
