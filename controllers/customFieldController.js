// controllers/customFieldController.js
// CRUD de custom fields e valores.

const CustomField = require('../models/customField');
const CustomFieldValue = require('../models/customFieldValue');

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

module.exports = {
  list,
  create,
  update,
  remove,
  upsertValue,
};
