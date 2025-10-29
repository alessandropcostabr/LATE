// controllers/messageWatcherController.js
// Administração dos watchers (observadores) de um contato.

const MessageWatcherModel = require('../models/messageWatcher');

exports.list = async (req, res) => {
  try {
    const messageId = Number(req.params.id);
    const watchers = await MessageWatcherModel.listForMessage(messageId);
    return res.json({ success: true, data: { watchers } });
  } catch (err) {
    console.error('[watchers] erro ao listar:', err);
    return res.status(500).json({ success: false, error: 'Falha ao listar observadores.' });
  }
};

exports.add = async (req, res) => {
  try {
    const messageId = Number(req.params.id);
    const userId = Number(req.body?.userId ?? req.body?.user_id);
    const watcher = await MessageWatcherModel.addWatcher({ messageId, userId });
    const watchers = await MessageWatcherModel.listForMessage(messageId);
    return res.status(201).json({ success: true, data: { watcher, watchers } });
  } catch (err) {
    if (err?.code === 'INVALID_USER') {
      return res.status(400).json({ success: false, error: 'Usuário inválido.' });
    }
    console.error('[watchers] erro ao adicionar observador:', err);
    return res.status(500).json({ success: false, error: 'Falha ao adicionar observador.' });
  }
};

exports.remove = async (req, res) => {
  try {
    const messageId = Number(req.params.id);
    const userId = Number(req.params.userId);
    await MessageWatcherModel.removeWatcher({ messageId, userId });
    const watchers = await MessageWatcherModel.listForMessage(messageId);
    return res.json({ success: true, data: { watchers } });
  } catch (err) {
    console.error('[watchers] erro ao remover observador:', err);
    return res.status(500).json({ success: false, error: 'Falha ao remover observador.' });
  }
};
