// controllers/crm/statsController.js

const CrmStats = require('../../models/crmStats');

async function statsPipeline(req, res) {
  try {
    const data = await CrmStats.pipelineByStageMonth({ user: req.session?.user });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[crm] statsPipeline', err);
    return res.status(500).json({ success: false, error: 'Erro ao obter estatísticas' });
  }
}

async function list(req, res) {
  try {
    const user = req.session?.user || {};
    const scope = req.scopeResolved || req.query.scope || 'me';
    const months = Math.max(1, Math.min(24, Number(req.query.months) || 6));

    const [pipeline, activities] = await Promise.all([
      CrmStats.pipelineByStageMonth({ user, months }),
      CrmStats.activitiesByOwner({ user }),
    ]);

    const refreshedAt = await CrmStats.refreshedAt();
    const stalenessSec = refreshedAt
      ? Math.max(0, Math.floor((Date.now() - refreshedAt.getTime()) / 1000))
      : null;

    return res.json({
      success: true,
      data: {
        pipeline,
        activities,
        refreshed_at: refreshedAt ? refreshedAt.toISOString() : null,
        staleness_seconds: stalenessSec,
        scope,
      },
    });
  } catch (err) {
    console.error('[crm-stats] erro ao listar stats', err);
    return res.status(500).json({ success: false, error: 'Erro ao obter estatísticas' });
  }
}

async function statsActivities(req, res) {
  try {
    const data = await CrmStats.activitiesByOwner({ user: req.session?.user });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[crm] statsActivities', err);
    return res.status(500).json({ success: false, error: 'Erro ao obter estatísticas' });
  }
}

async function refreshStats(_req, res) {
  try {
    await CrmStats.refreshMaterializedViews();
    return res.json({ success: true, data: { refreshed: true } });
  } catch (err) {
    console.error('[crm] refreshStats', err);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar estatísticas' });
  }
}

module.exports = {
  list,
  statsPipeline,
  statsActivities,
  refreshStats,
};
