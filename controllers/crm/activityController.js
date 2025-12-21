// controllers/crm/activityController.js

const ActivityModel = require('../../models/activity');
const { applyOwnerScope } = require('../../utils/scope');
const {
  formatIcsDate,
  isPrivileged,
  persistCustomFields,
  resolveViewScope,
  validateCustomRequired,
} = require('./helpers');

async function createActivity(req, res) {
  try {
    const customInput = req.body.custom_fields || {};
    const payload = {
      type: req.body.type || 'task',
      subject: req.body.subject,
      starts_at: req.body.starts_at || null,
      ends_at: req.body.ends_at || null,
      owner_id: req.session?.user?.id || null,
      related_type: req.body.related_type || null,
      related_id: req.body.related_id || null,
      status: req.body.status || 'pending',
      location: req.body.location || null,
    };
    const missingCustom = await validateCustomRequired('activity', customInput);
    if (missingCustom.length) {
      return res.status(400).json({ success: false, error: `Campos obrigatórios: ${missingCustom.join(', ')}` });
    }
    const activity = await ActivityModel.createActivity(payload);
    await persistCustomFields('activity', activity.id, customInput);
    return res.json({ success: true, data: activity });
  } catch (err) {
    console.error('[crm] createActivity', err);
    return res.status(500).json({ success: false, error: 'Erro ao criar atividade' });
  }
}

async function listActivities(req, res) {
  try {
    const filter = {
      related_type: req.query.related_type || null,
      related_id: req.query.related_id || null,
      owner_id: null,
    };
    const scopeParam = req.scopeResolved || req.query.scope || resolveViewScope(req);
    const { filter: scopedFilter, scope } = applyOwnerScope(
      {
        ...filter,
        owner_id: req.query.owner_id || null,
      },
      req.session?.user || {},
      scopeParam,
    );

    const rows = await ActivityModel.listActivities(scopedFilter);
    return res.json({ success: true, data: rows, scope });
  } catch (err) {
    console.error('[crm] listActivities', err);
    return res.status(500).json({ success: false, error: 'Erro ao listar atividades' });
  }
}

async function updateActivityStatus(req, res) {
  try {
    const id = req.params.id;
    const status = req.body.status;
    if (!status) return res.status(400).json({ success: false, error: 'Status é obrigatório' });
    const updated = await ActivityModel.updateStatus(id, status);
    if (!updated) return res.status(404).json({ success: false, error: 'Atividade não encontrada' });
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[crm] updateActivityStatus', err);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar atividade' });
  }
}

async function exportActivitiesICS(req, res) {
  try {
    const filter = {};
    const role = req.session?.user?.role || '';
    const userId = req.session?.user?.id;
    const scope = resolveViewScope(req);
    if (!isPrivileged(role) && userId) filter.owner_id = userId;
    const rows = await ActivityModel.listActivities(filter);
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LATE//CRM//PT-BR'];
    rows.forEach((a) => {
      const uid = `${a.id || Math.random()}@late`;
      const dtStart = formatIcsDate(a.starts_at) || formatIcsDate(a.created_at);
      const dtEnd = formatIcsDate(a.ends_at) || dtStart;
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}`);
      if (dtStart) lines.push(`DTSTART:${dtStart}`);
      if (dtEnd) lines.push(`DTEND:${dtEnd}`);
      lines.push(`SUMMARY:${a.subject || 'Atividade'}`);
      if (a.status) lines.push(`STATUS:${a.status}`);
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    return res.send(lines.join('\r\n'));
  } catch (err) {
    console.error('[crm] exportActivitiesICS', err);
    return res.status(500).json({ success: false, error: 'Erro ao exportar ICS' });
  }
}

module.exports = {
  createActivity,
  listActivities,
  updateActivityStatus,
  exportActivitiesICS,
};
