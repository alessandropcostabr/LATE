// controllers/messageChecklistController.js
// Operações de checklists e itens associados aos contatos.

const MessageChecklistModel = require('../models/messageChecklist');

exports.list = async (req, res) => {
  try {
    const messageId = Number(req.params.id);
    const checklists = await MessageChecklistModel.listByMessage(messageId);
    return res.json({ success: true, data: { checklists } });
  } catch (err) {
    console.error('[checklists] erro ao listar:', err);
    return res.status(500).json({ success: false, error: 'Falha ao listar checklists.' });
  }
};

exports.create = async (req, res) => {
  try {
    const messageId = Number(req.params.id);
    const title = String(req.body?.title || '').trim();
    const checklist = await MessageChecklistModel.create({ messageId, title });
    return res.status(201).json({ success: true, data: { checklist } });
  } catch (err) {
    if (err?.code === 'INVALID_TITLE') {
      return res.status(400).json({ success: false, error: 'Título do checklist inválido.' });
    }
    console.error('[checklists] erro ao criar checklist:', err);
    return res.status(500).json({ success: false, error: 'Falha ao criar checklist.' });
  }
};

exports.update = async (req, res) => {
  try {
    const checklistId = String(req.params.checklistId || '');
    const title = req.body?.title;
    const checklist = await MessageChecklistModel.update(checklistId, { title });
    if (!checklist) {
      return res.status(404).json({ success: false, error: 'Checklist não encontrado.' });
    }
    return res.json({ success: true, data: { checklist } });
  } catch (err) {
    if (err?.code === 'INVALID_TITLE') {
      return res.status(400).json({ success: false, error: 'Título do checklist inválido.' });
    }
    console.error('[checklists] erro ao atualizar checklist:', err);
    return res.status(500).json({ success: false, error: 'Falha ao atualizar checklist.' });
  }
};

exports.remove = async (req, res) => {
  try {
    const checklistId = String(req.params.checklistId || '');
    const removed = await MessageChecklistModel.remove(checklistId);
    if (!removed) {
      return res.status(404).json({ success: false, error: 'Checklist não encontrado.' });
    }
    return res.json({ success: true, data: { removed: true } });
  } catch (err) {
    console.error('[checklists] erro ao remover checklist:', err);
    return res.status(500).json({ success: false, error: 'Falha ao remover checklist.' });
  }
};

exports.listItems = async (req, res) => {
  try {
    const checklistId = String(req.params.checklistId || '');
    const checklist = await MessageChecklistModel.findById(checklistId);
    if (!checklist) {
      return res.status(404).json({ success: false, error: 'Checklist não encontrado.' });
    }
    const all = await MessageChecklistModel.listByMessage(checklist.message_id);
    const current = all.find((item) => item.id === checklistId);
    const items = current?.items || [];
    return res.json({ success: true, data: { items, checklistId } });
  } catch (err) {
    console.error('[checklists] erro ao listar itens:', err);
    return res.status(500).json({ success: false, error: 'Falha ao listar itens.' });
  }
};

exports.createItem = async (req, res) => {
  try {
    const checklistId = String(req.params.checklistId || '');
    const title = String(req.body?.title || '').trim();
    const item = await MessageChecklistModel.createItem({ checklistId, title });
    return res.status(201).json({ success: true, data: { item } });
  } catch (err) {
    if (err?.code === 'INVALID_TITLE') {
      return res.status(400).json({ success: false, error: 'Título do item inválido.' });
    }
    console.error('[checklists] erro ao criar item:', err);
    return res.status(500).json({ success: false, error: 'Falha ao criar item do checklist.' });
  }
};

exports.updateItem = async (req, res) => {
  try {
    const itemId = String(req.params.itemId || '');
    const payload = {
      title: req.body?.title,
      done: req.body?.done,
      position: req.body?.position,
    };
    const item = await MessageChecklistModel.updateItem(itemId, payload);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item não encontrado.' });
    }
    return res.json({ success: true, data: { item } });
  } catch (err) {
    if (err?.code === 'INVALID_TITLE') {
      return res.status(400).json({ success: false, error: 'Título do item inválido.' });
    }
    console.error('[checklists] erro ao atualizar item:', err);
    return res.status(500).json({ success: false, error: 'Falha ao atualizar item do checklist.' });
  }
};

exports.removeItem = async (req, res) => {
  try {
    const itemId = String(req.params.itemId || '');
    const removed = await MessageChecklistModel.removeItem(itemId);
    if (!removed) {
      return res.status(404).json({ success: false, error: 'Item não encontrado.' });
    }
    return res.json({ success: true, data: { removed: true } });
  } catch (err) {
    console.error('[checklists] erro ao remover item:', err);
    return res.status(500).json({ success: false, error: 'Falha ao remover item do checklist.' });
  }
};
