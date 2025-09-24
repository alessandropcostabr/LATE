const MessageModel = require('../models/message');

function formatMessage(message) {
  if (!message) return null;
  return {
    ...message,
    status_label: MessageModel.STATUS_LABELS_PT[message.status] || message.status,
  };
}

exports.list = (req, res) => {
  try {
    const { limit, offset, status } = req.query || {};
    const messages = MessageModel.list({ limit, offset, status }).map(formatMessage);
    return res.json({ success: true, data: messages });
  } catch (err) {
    console.error('[messages] erro ao listar:', err);
    return res.status(500).json({ success: false, error: 'Erro ao listar mensagens.' });
  }
};

exports.getById = (req, res) => {
  try {
    const id = Number(req.params.id);
    const message = MessageModel.findById(id);
    if (!message) {
      return res.status(404).json({ success: false, error: 'Mensagem não encontrada.' });
    }
    return res.json({ success: true, data: formatMessage(message) });
  } catch (err) {
    console.error('[messages] erro ao obter mensagem:', err);
    return res.status(500).json({ success: false, error: 'Erro ao obter mensagem.' });
  }
};

exports.create = (req, res) => {
  try {
    const id = MessageModel.create(req.body || {});
    const message = MessageModel.findById(id);
    const formatted = message ? formatMessage(message) : { id };
    return res.status(201).json({ success: true, data: formatted });
  } catch (err) {
    console.error('[messages] erro ao criar mensagem:', err);
    return res.status(500).json({ success: false, error: 'Erro ao criar mensagem.' });
  }
};

exports.update = (req, res) => {
  try {
    const id = Number(req.params.id);
    const updated = MessageModel.update(id, req.body || {});
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Mensagem não encontrada para atualização.' });
    }
    const message = MessageModel.findById(id);
    return res.json({ success: true, data: formatMessage(message) });
  } catch (err) {
    console.error('[messages] erro ao atualizar mensagem:', err);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar mensagem.' });
  }
};

exports.updateStatus = (req, res) => {
  try {
    const id = Number(req.params.id);
    const status = req.body?.status;
    const updated = MessageModel.updateStatus(id, status);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Mensagem não encontrada para atualização de status.' });
    }
    const message = MessageModel.findById(id);
    return res.json({ success: true, data: formatMessage(message) });
  } catch (err) {
    console.error('[messages] erro ao atualizar status:', err);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar status da mensagem.' });
  }
};

exports.remove = (req, res) => {
  try {
    const id = Number(req.params.id);
    const removed = MessageModel.remove(id);
    if (!removed) {
      return res.status(404).json({ success: false, error: 'Mensagem não encontrada para exclusão.' });
    }
    return res.json({ success: true, data: { id, deleted: true } });
  } catch (err) {
    console.error('[messages] erro ao excluir mensagem:', err);
    return res.status(500).json({ success: false, error: 'Erro ao excluir mensagem.' });
  }
};

exports.stats = (_req, res) => {
  try {
    const stats = MessageModel.stats();
    return res.json({
      success: true,
      data: {
        ...stats,
        labels: MessageModel.STATUS_LABELS_PT,
      },
    });
  } catch (err) {
    console.error('[messages] erro nas estatísticas:', err);
    return res.status(500).json({ success: false, error: 'Erro ao obter estatísticas.' });
  }
};
