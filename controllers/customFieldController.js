// controllers/customFieldController.js
// CRUD de custom fields e valores.

const CustomField = require('../models/customField');
const CustomFieldValue = require('../models/customFieldValue');
const LeadModel = require('../models/lead');
const OpportunityModel = require('../models/opportunity');
const ActivityModel = require('../models/activity');

function isPrivileged(role) {
  const value = String(role || '').toUpperCase();
  return value === 'ADMIN' || value === 'SUPERVISOR';
}

async function list(req, res) {
  try {
    const data = await CustomField.list(req.query.entity);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[crm] list custom fields', err);
    return res.status(500).json({ success: false, error: 'Erro ao listar campos' });
  }
}

async function create(req, res) {
  try {
    const field = await CustomField.create(req.body);
    return res.json({ success: true, data: field });
  } catch (err) {
    console.error('[crm] create custom field', err);
    return res.status(500).json({ success: false, error: 'Erro ao criar campo' });
  }
}

async function update(req, res) {
  try {
    const updated = await CustomField.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, error: 'Campo não encontrado' });
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[crm] update custom field', err);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar campo' });
  }
}

async function remove(req, res) {
  try {
    const ok = await CustomField.remove(req.params.id);
    if (!ok) return res.status(404).json({ success: false, error: 'Campo não encontrado' });
    return res.json({ success: true });
  } catch (err) {
    console.error('[crm] remove custom field', err);
    return res.status(500).json({ success: false, error: 'Erro ao remover campo' });
  }
}

async function upsertValue(req, res) {
  try {
    const row = await CustomFieldValue.upsert({
      field_id: req.params.id,
      entity_type: req.body.entity_type,
      entity_id: req.body.entity_id,
      value: req.body.value,
    });
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error('[crm] upsert custom field value', err);
    return res.status(500).json({ success: false, error: 'Erro ao salvar valor' });
  }
}

async function listValues(req, res) {
  try {
    const entityType = String(req.query.entity_type || '').toLowerCase();
    const entityId = req.query.entity_id;
    const userId = req.session?.user?.id || null;
    const role = req.session?.user?.role || '';
    const privileged = isPrivileged(role);

    if (!privileged) {
      if (entityType === 'lead') {
        const lead = await LeadModel.findById(entityId);
        if (!lead) return res.status(404).json({ success: false, error: 'Lead não encontrado' });
        if (lead.owner_id && lead.owner_id !== userId) {
          return res.status(403).json({ success: false, error: 'Acesso negado' });
        }
      } else if (entityType === 'opportunity') {
        const opp = await OpportunityModel.findById(entityId);
        if (!opp) return res.status(404).json({ success: false, error: 'Oportunidade não encontrada' });
        if (opp.owner_id && opp.owner_id !== userId) {
          return res.status(403).json({ success: false, error: 'Acesso negado' });
        }
      } else if (entityType === 'activity') {
        const activity = await ActivityModel.findById(entityId);
        if (!activity) return res.status(404).json({ success: false, error: 'Atividade não encontrada' });
        if (activity.owner_id && activity.owner_id !== userId) {
          return res.status(403).json({ success: false, error: 'Acesso negado' });
        }
      } else {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }
    }

    const rows = await CustomFieldValue.listValues(entityType, entityId);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[crm] list custom field values', err);
    return res.status(500).json({ success: false, error: 'Erro ao listar valores' });
  }
}

module.exports = {
  list,
  create,
  update,
  remove,
  upsertValue,
  listValues,
};
