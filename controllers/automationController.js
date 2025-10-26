// controllers/automationController.js
// CRUD das automations configuráveis do sistema.

const AutomationModel = require('../models/automation');
const AutomationLogModel = require('../models/automationLog');

exports.list = async (_req, res) => {
  try {
    const automations = await AutomationModel.list();
    return res.json({ success: true, data: { automations } });
  } catch (err) {
    console.error('[automations] erro ao listar:', err);
    return res.status(500).json({ success: false, error: 'Falha ao listar automations.' });
  }
};

exports.get = async (req, res) => {
  try {
    const { id } = req.params;
    const automation = await AutomationModel.findById(id);
    if (!automation) {
      return res.status(404).json({ success: false, error: 'Automation não encontrada.' });
    }
    return res.json({ success: true, data: { automation } });
  } catch (err) {
    console.error('[automations] erro ao obter automation:', err);
    return res.status(500).json({ success: false, error: 'Falha ao carregar automation.' });
  }
};

exports.create = async (req, res) => {
  try {
    const automation = await AutomationModel.create({
      event: req.body?.event,
      conditionJson: req.body?.condition,
      actionJson: req.body?.action,
      description: req.body?.description,
    });
    return res.status(201).json({ success: true, data: { automation } });
  } catch (err) {
    if (err?.code === 'INVALID_EVENT') {
      return res.status(400).json({ success: false, error: 'Evento inválido.' });
    }
    if (err?.code === 'INVALID_JSON' || err?.code === 'INVALID_ACTION') {
      return res.status(400).json({ success: false, error: 'Payload inválido para automação.' });
    }
    console.error('[automations] erro ao criar automation:', err);
    return res.status(500).json({ success: false, error: 'Falha ao criar automation.' });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const automation = await AutomationModel.update(id, {
      event: req.body?.event,
      conditionJson: req.body?.condition,
      actionJson: req.body?.action,
      description: req.body?.description,
      isActive: req.body?.isActive,
    });
    if (!automation) {
      return res.status(404).json({ success: false, error: 'Automation não encontrada.' });
    }
    return res.json({ success: true, data: { automation } });
  } catch (err) {
    if (err?.code === 'INVALID_EVENT') {
      return res.status(400).json({ success: false, error: 'Evento inválido.' });
    }
    if (err?.code === 'INVALID_JSON' || err?.code === 'INVALID_ACTION') {
      return res.status(400).json({ success: false, error: 'Payload inválido para automação.' });
    }
    console.error('[automations] erro ao atualizar automation:', err);
    return res.status(500).json({ success: false, error: 'Falha ao atualizar automation.' });
  }
};

exports.toggle = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body || {};
    const automation = await AutomationModel.setActive(id, Boolean(active));
    if (!automation) {
      return res.status(404).json({ success: false, error: 'Automation não encontrada.' });
    }
    return res.json({ success: true, data: { automation } });
  } catch (err) {
    console.error('[automations] erro ao alternar automation:', err);
    return res.status(500).json({ success: false, error: 'Falha ao atualizar status da automation.' });
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const removed = await AutomationModel.remove(id);
    if (!removed) {
      return res.status(404).json({ success: false, error: 'Automation não encontrada.' });
    }
    return res.json({ success: true, data: { removed: true } });
  } catch (err) {
    console.error('[automations] erro ao remover automation:', err);
    return res.status(500).json({ success: false, error: 'Falha ao remover automation.' });
  }
};

exports.listLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const logs = await AutomationLogModel.listByAutomation(id, {
      limit: req.query.limit,
      offset: req.query.offset,
    });
    return res.json({ success: true, data: { logs } });
  } catch (err) {
    console.error('[automations] erro ao listar logs:', err);
    return res.status(500).json({ success: false, error: 'Falha ao listar logs da automation.' });
  }
};
