// controllers/crmImportViewController.js
// Tela de importação CSV do CRM.

const PipelineModel = require('../models/pipeline');

async function importPage(req, res) {
  try {
    const pipelines = await PipelineModel.listPipelines('opportunity');
    const stagesByPipeline = {};
    for (const pipeline of pipelines) {
      stagesByPipeline[pipeline.id] = await PipelineModel.getStages(pipeline.id);
    }
    return res.render('crm-import', {
      title: 'CRM · Importação',
      user: req.session.user || null,
      pipelines,
      stagesByPipeline,
      csrfToken: typeof req.csrfToken === 'function' ? req.csrfToken() : null,
    });
  } catch (err) {
    console.error('[web][crm-import]', err);
    return res.status(500).render('500', { title: 'Erro', user: req.session.user || null });
  }
}

module.exports = {
  importPage,
};
