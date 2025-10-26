// controllers/messageLabelController.js
// Operações de labels (tags) associadas aos recados.

const MessageLabelModel = require('../models/messageLabel');

exports.list = async (req, res) => {
  try {
    const messageId = Number(req.params.id);
    const labels = await MessageLabelModel.listByMessage(messageId);
    return res.json({ success: true, data: { labels } });
  } catch (err) {
    console.error('[labels] erro ao listar:', err);
    return res.status(500).json({ success: false, error: 'Falha ao listar labels.' });
  }
};

exports.add = async (req, res) => {
  try {
    const messageId = Number(req.params.id);
    const label = String(req.body?.label || '').trim();
    const created = await MessageLabelModel.addLabel(messageId, label);
    const labels = await MessageLabelModel.listByMessage(messageId);
    return res.status(201).json({ success: true, data: { label: created, labels } });
  } catch (err) {
    if (err?.code === 'INVALID_LABEL') {
      return res.status(400).json({ success: false, error: 'Label inválida. Use 2 a 32 caracteres (a-z, 0-9, -, _, .).' });
    }
    console.error('[labels] erro ao adicionar:', err);
    return res.status(500).json({ success: false, error: 'Falha ao adicionar label.' });
  }
};

exports.remove = async (req, res) => {
  try {
    const messageId = Number(req.params.id);
    const label = decodeURIComponent(String(req.params.label || '').trim());
    await MessageLabelModel.removeLabel(messageId, label);
    const labels = await MessageLabelModel.listByMessage(messageId);
    return res.json({ success: true, data: { labels } });
  } catch (err) {
    console.error('[labels] erro ao remover:', err);
    return res.status(500).json({ success: false, error: 'Falha ao remover label.' });
  }
};

exports.replace = async (req, res) => {
  try {
    const messageId = Number(req.params.id);
    const incoming = Array.isArray(req.body?.labels) ? req.body.labels : [];
    const normalized = await MessageLabelModel.replaceLabels(messageId, incoming);
    return res.json({ success: true, data: { labels: normalized } });
  } catch (err) {
    if (err?.code === 'INVALID_LABEL') {
      return res.status(400).json({ success: false, error: 'Labels inválidas.' });
    }
    console.error('[labels] erro ao substituir labels:', err);
    return res.status(500).json({ success: false, error: 'Falha ao atualizar labels.' });
  }
};
