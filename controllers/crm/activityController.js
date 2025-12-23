// controllers/crm/activityController.js

const ActivityModel = require('../../models/activity');
const CustomFieldValueModel = require('../../models/customFieldValue');
const { applyOwnerScope } = require('../../utils/scope');
const { logEvent: logAuditEvent } = require('../../utils/auditLogger');
const {
  buildDiff,
  formatIcsDate,
  isPrivileged,
  persistCustomFields,
  resolveViewScope,
  validateCustomRequired,
} = require('./helpers');

const ACTIVITY_ALLOWED_FIELDS = new Set([
  'type',
  'subject',
  'starts_at',
  'ends_at',
  'status',
  'location',
  'related_type',
  'related_id',
  'custom_fields',
]);

function collectInvalidFields(body = {}, allowedSet) {
  return Object.keys(body).filter((key) => !allowedSet.has(key));
}

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
    const activity = await ActivityModel.findById(id);
    if (!activity) return res.status(404).json({ success: false, error: 'Atividade não encontrada' });

    const role = req.session?.user?.role || '';
    const userId = req.session?.user?.id;
    if (!isPrivileged(role) && (!userId || activity.owner_id !== userId)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const updated = await ActivityModel.updateStatus(id, status);
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[crm] updateActivityStatus', err);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar atividade' });
  }
}

async function updateActivity(req, res) {
  try {
    const id = req.params.id;
    const body = req.body || {};
    const invalid = collectInvalidFields(body, ACTIVITY_ALLOWED_FIELDS);
    if (invalid.length) {
      return res.status(400).json({ success: false, error: `Campos não permitidos: ${invalid.join(', ')}` });
    }

    const activity = await ActivityModel.findById(id);
    if (!activity) return res.status(404).json({ success: false, error: 'Atividade não encontrada' });

    const role = req.session?.user?.role || '';
    const userId = req.session?.user?.id;
    if (!isPrivileged(role) && (!userId || activity.owner_id !== userId)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const updates = {};
    if (Object.prototype.hasOwnProperty.call(body, 'type')) updates.type = body.type || null;
    if (Object.prototype.hasOwnProperty.call(body, 'subject')) updates.subject = body.subject || null;
    if (Object.prototype.hasOwnProperty.call(body, 'starts_at')) updates.starts_at = body.starts_at || null;
    if (Object.prototype.hasOwnProperty.call(body, 'ends_at')) updates.ends_at = body.ends_at || null;
    if (Object.prototype.hasOwnProperty.call(body, 'status')) updates.status = body.status || null;
    if (Object.prototype.hasOwnProperty.call(body, 'location')) updates.location = body.location || null;
    if (Object.prototype.hasOwnProperty.call(body, 'related_type')) updates.related_type = body.related_type || null;
    if (Object.prototype.hasOwnProperty.call(body, 'related_id')) updates.related_id = body.related_id || null;

    const customInput = body.custom_fields || {};
    if (Object.keys(customInput).length) {
      const existingCustomValues = await CustomFieldValueModel.listValues('activity', id);
      const missingCustom = await validateCustomRequired('activity', customInput, existingCustomValues);
      if (missingCustom.length) {
        return res.status(400).json({ success: false, error: `Campos obrigatórios: ${missingCustom.join(', ')}` });
      }
      await persistCustomFields('activity', id, customInput);
    }

    const updated = Object.keys(updates).length ? await ActivityModel.updateActivity(id, updates) : null;
    if (!updated && !Object.keys(customInput).length) {
      return res.status(400).json({ success: false, error: 'Nenhuma alteração informada' });
    }

    const currentActivity = updated || await ActivityModel.findById(id);
    const diff = buildDiff(activity, currentActivity, [
      'type',
      'subject',
      'starts_at',
      'ends_at',
      'status',
      'location',
      'related_type',
      'related_id',
    ]);
    if (Object.keys(diff).length) {
      await logAuditEvent('crm.activity.updated', {
        entityType: 'activity',
        entityId: id,
        actorUserId: userId || null,
        metadata: { changed: diff },
      });
    }

    return res.json({ success: true, data: currentActivity });
  } catch (err) {
    console.error('[crm] updateActivity', err);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar atividade' });
  }
}

async function deleteActivity(req, res) {
  try {
    const id = req.params.id;
    const activity = await ActivityModel.findById(id);
    if (!activity) return res.status(404).json({ success: false, error: 'Atividade não encontrada' });

    const role = req.session?.user?.role || '';
    const userId = req.session?.user?.id;
    if (!isPrivileged(role) && (!userId || activity.owner_id !== userId)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const removed = await ActivityModel.softDelete(id);
    if (!removed) return res.status(404).json({ success: false, error: 'Atividade não encontrada' });

    await logAuditEvent('crm.activity.deleted', {
      entityType: 'activity',
      entityId: id,
      actorUserId: userId || null,
      metadata: { dependencies: { count: 0 } },
    });

    return res.json({ success: true, data: removed });
  } catch (err) {
    console.error('[crm] deleteActivity', err);
    return res.status(500).json({ success: false, error: 'Erro ao excluir atividade' });
  }
}

async function activityDependencies(req, res) {
  try {
    const id = req.params.id;
    const activity = await ActivityModel.findById(id);
    if (!activity) return res.status(404).json({ success: false, error: 'Atividade não encontrada' });

    const role = req.session?.user?.role || '';
    const userId = req.session?.user?.id;
    if (!isPrivileged(role) && (!userId || activity.owner_id !== userId)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    return res.json({ success: true, data: { counts: { count: 0 } } });
  } catch (err) {
    console.error('[crm] activityDependencies', err);
    return res.status(500).json({ success: false, error: 'Erro ao carregar dependências' });
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
  updateActivity,
  deleteActivity,
  activityDependencies,
  exportActivitiesICS,
};
